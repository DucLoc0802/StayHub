import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { demoAccounts, demoAccommodations } from '../prisma/demo-data';
import { legacyDemoProperties } from '../prisma/legacy-demo-data';
import { propertySlug } from '../src/properties/property-slug';

const prisma = new PrismaClient();
const legacyNames: Record<string, string[]> = {
  'admin@stayhub.local': ['Quản trị demo StayHub'],
  'guest@stayhub.local': ['Khách demo StayHub'],
  'host@stayhub.local': ['Chủ nhà demo Trung tâm'],
  'host.east@stayhub.local': ['Chủ nhà demo phía Đông'],
  'host.south@stayhub.local': ['Chủ nhà demo phía Nam'],
};
const retiredUsers = [
  [
    '990680d3-35f6-4195-b719-e96ab19c31f5',
    'pendinghost@stayhub.local',
    'Chủ nhà demo chờ duyệt',
  ],
  [
    'be13e44b-d4df-4543-8ab7-bac3c77ffe6f',
    'inventory-demo@stayhub.local',
    'Khách minh họa lịch phòng',
  ],
];
async function main() {
  const apply = process.argv.includes('--apply'),
    rehearsal = process.argv.includes('--rehearsal');
  const url = new URL(process.env.DATABASE_URL!);
  if (
    rehearsal &&
    !(
      ['127.0.0.1', 'localhost'].includes(url.hostname) &&
      /^stayhub_.*_rehearsal_test$/.test(url.pathname.slice(1))
    )
  )
    throw Error('ISOLATED_REHEARSAL_REQUIRED');
  if (apply && !rehearsal) {
    const backup = process.env.VERIFIED_BACKUP_PATH!;
    const manifest = JSON.parse(
      fs.readFileSync(backup + '.manifest.json', 'utf8'),
    );
    const verified = JSON.parse(
      fs.readFileSync(backup + '.restore-verified.json', 'utf8'),
    );
    if (
      manifest.host !== url.hostname ||
      manifest.database !== url.pathname.slice(1) ||
      verified.backupSha256 !== manifest.sha256 ||
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(backup))
        .digest('hex') !== manifest.sha256
    )
      throw Error('MATCHING_VERIFIED_BACKUP_REQUIRED');
  }
  const users = await prisma.user.findMany();
  const properties = await prisma.property.findMany({
    include: { host: { select: { email: true } } },
  });
  const missing = demoAccounts.filter(
    ([email]) => !users.some((u) => u.email === email),
  );
  const renamed = demoAccounts.flatMap(([email, name]) => {
    const u = users.find((v) => v.email === email);
    return u && legacyNames[email]?.includes(u.fullName)
      ? [{ id: u.id, email, from: u.fullName, to: name }]
      : [];
  });
  const archiveProperties = legacyDemoProperties.filter((old) =>
    properties.some(
      (p) =>
        p.id === old.id &&
        p.name === old.name &&
        p.address === old.address &&
        p.description === old.description &&
        p.host.email === old.hostEmail &&
        !p.archivedAt,
    ),
  );
  const archiveUsers = retiredUsers.filter(([id, email, name]) =>
    users.some(
      (u) =>
        u.id === id &&
        u.email === email &&
        u.fullName === name &&
        !u.archivedAt,
    ),
  );
  const newProperties = demoAccommodations.filter(
    (p) => !properties.some((old) => old.id === p.id),
  );
  const plan = {
    mode: apply ? 'apply' : 'preview',
    renameAccounts: renamed,
    createAccounts: missing.map(([email, name, role]) => ({
      email,
      name,
      role,
    })),
    archiveAccounts: archiveUsers.map(([id, email]) => ({ id, email })),
    archiveProperties: archiveProperties.map((p) => ({
      id: p.id,
      name: p.name,
    })),
    createProperties: newProperties.map((p) => ({
      id: p.id,
      name: p.name,
      hostEmail: p.hostEmail,
    })),
    financialRecordsChanged: false,
  };
  if (!apply) {
    console.log(JSON.stringify(plan));
    return;
  }
  const credentialPath = path.resolve(
    process.env.FIXTURE_CREDENTIALS_PATH ??
      '../.local/production-fixture-credentials.json',
  );
  const credentials: Record<string, string> = fs.existsSync(credentialPath)
    ? JSON.parse(fs.readFileSync(credentialPath, 'utf8'))
    : {};
  for (const [email] of missing)
    credentials[email] ??= crypto.randomBytes(24).toString('base64url');
  if (missing.length) {
    fs.mkdirSync(path.dirname(credentialPath), { recursive: true });
    fs.writeFileSync(credentialPath, JSON.stringify(credentials, null, 2), {
      mode: 0o600,
    });
  }
  const hashes = new Map(
    await Promise.all(
      missing.map(
        async ([email]) =>
          [email, await bcrypt.hash(credentials[email], 12)] as const,
      ),
    ),
  );
  await prisma.$transaction(
    async (tx) => {
      for (const change of renamed)
        await tx.user.updateMany({
          where: { id: change.id, email: change.email, fullName: change.from },
          data: { fullName: change.to },
        });
      for (const [email, fullName, role, status] of missing) {
        const suffix =
          fullName === 'host04' ? '4' : fullName === 'host05' ? '5' : null;
        if (!suffix) throw Error('UNEXPECTED_MISSING_ACCOUNT');
        await tx.user.create({
          data: {
            id: `74000000-0000-4000-8000-00000000000${suffix}`,
            email,
            fullName,
            role,
            status,
            passwordHash: hashes.get(email)!,
          },
        });
      }
      for (const [id, email, fullName] of archiveUsers)
        await tx.user.updateMany({
          where: { id, email, fullName, archivedAt: null },
          data: { archivedAt: new Date() },
        });
      for (const p of archiveProperties)
        await tx.property.updateMany({
          where: {
            id: p.id,
            name: p.name,
            address: p.address,
            description: p.description,
            archivedAt: null,
          },
          data: { status: 'INACTIVE', archivedAt: new Date() },
        });
      const amenities = await tx.amenity.findMany();
      for (const {
        hostEmail,
        codes,
        images,
        roomTypes,
        ...p
      } of newProperties) {
        const owner = await tx.user.findUniqueOrThrow({
          where: { email: hostEmail },
        });
        if (owner.role !== 'HOST' || owner.archivedAt)
          throw Error('INVALID_FIXTURE_OWNER');
        await tx.property.create({
          data: {
            ...p,
            slug: propertySlug(p.name),
            hostId: owner.id,
            images: { create: images },
            amenities: {
              create: codes.map((code) => {
                const a = amenities.find((a) => a.code === code);
                if (!a) throw Error('MISSING_AMENITY');
                return { amenityId: a.id };
              }),
            },
            roomTypes: {
              create: roomTypes.map(({ propertyId, ...room }) => {
                void propertyId;
                return room;
              }),
            },
          },
        });
      }
    },
    { timeout: 30000 },
  );
  const activeUsers = await prisma.user.groupBy({
    by: ['role'],
    where: { archivedAt: null },
    _count: true,
  });
  const activeProperties = await prisma.property.findMany({
    where: { archivedAt: null },
    select: { id: true, hostId: true, name: true },
  });
  console.log(
    JSON.stringify({
      ...plan,
      verified: {
        activeUsers,
        properties: activeProperties.length,
        owners: new Set(activeProperties.map((p) => p.hostId)).size,
      },
      credentialFile: missing.length ? credentialPath : undefined,
    }),
  );
}
main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        error: /^[A-Z_]+$/.test(error.message ?? '')
          ? error.message
          : 'CATALOG_SYNC_FAILED',
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
