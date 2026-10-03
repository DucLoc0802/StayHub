import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  demoAccounts,
  demoAmenities,
  demoProperties,
  legacySeedProperties,
} from './demo-data';

const prisma = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash('StayHub123!', 12);
  const users = new Map<string, { id: string; role: string; status: string }>();
  for (const [email, fullName, role, status] of demoAccounts) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, fullName, role, status, passwordHash },
    });
    users.set(email, user);
  }
  // Replace only the original fictional display names, preserving credentials,
  // roles, approval decisions and any user-customized display name.
  for (const [email, legacyName] of [
    ['guest@stayhub.local', 'Nguyễn Minh Anh'],
    ['host@stayhub.local', 'Trần Hoàng Nam'],
    ['pendinghost@stayhub.local', 'Lê Thảo Nguyên'],
  ]) {
    await prisma.user.updateMany({
      where: { email, fullName: legacyName },
      data: { fullName: demoAccounts.find((a) => a[0] === email)![1] },
    });
  }
  for (const [code, nameVi] of demoAmenities) {
    await prisma.amenity.upsert({
      where: { code },
      update: {},
      create: { code, nameVi },
    });
  }
  const amenities = new Map(
    (await prisma.amenity.findMany()).map((a) => [a.code, a.id]),
  );
  let created = 0;
  let upgraded = 0;
  let preserved = 0;
  for (const { hostEmail, codes, images, ...data } of demoProperties) {
    const host = users.get(hostEmail)!;
    await prisma.$transaction(async (tx) => {
      const existing = await tx.property.findUnique({
        where: { id: data.id },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          amenities: { include: { amenity: true } },
        },
      });
      const old = legacySeedProperties[Number(data.id.slice(-12)) - 1];
      const untouchedLegacy =
        existing &&
        old &&
        existing.hostId === host.id &&
        host.role === 'HOST' &&
        host.status === 'ACTIVE' &&
        Object.entries(old.data).every(
          ([key, value]) => existing[key as keyof typeof old.data] === value,
        ) &&
        JSON.stringify(
          existing.images.map(({ url, sortOrder }) => ({ url, sortOrder })),
        ) === JSON.stringify(old.images) &&
        existing.amenities
          .map(({ amenity }) => amenity.code)
          .sort()
          .join(',') === old.codes.slice().sort().join(',');
      const relations = {
        images: { create: images },
        amenities: {
          create: codes.map((code) => ({ amenityId: amenities.get(code)! })),
        },
      };
      if (untouchedLegacy) {
        // Upgrade the recognized old seed once; retain ID/owner/status/history.
        const { status, ...scalars } = data;
        void status;
        await tx.property.update({
          where: { id: data.id },
          data: {
            ...scalars,
            images: { deleteMany: {}, ...relations.images },
            amenities: { deleteMany: {}, ...relations.amenities },
          },
        });
        upgraded++;
      } else if (existing) {
        preserved++;
      } else {
        if (host.role !== 'HOST' || host.status !== 'ACTIVE') {
          throw new Error(
            `Demo host must be an approved ACTIVE HOST to create properties: ${hostEmail}`,
          );
        }
        await tx.property.create({
          data: { ...data, hostId: host.id, ...relations },
        });
        created++;
      }
    });
  }
  console.info(
    JSON.stringify(
      {
        dataset: 'StayHub synthetic demo',
        targetProperties: demoProperties.length,
        created,
        upgradedLegacy: upgraded,
        preserved,
      },
      null,
      2,
    ),
  );
}
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo seed failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
