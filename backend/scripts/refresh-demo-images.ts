import fs from 'node:fs';
import crypto from 'node:crypto';
import type {
  Connection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';
import { connectDatabase, safeFailure } from './database-connection.mjs';
import { demoAccommodations } from '../prisma/demo-data';
import { demoImageUrl, retiredDemoPhotoIds } from '../prisma/demo-images';

interface PhotoRow extends RowDataPacket {
  propertyId: string;
  propertyName: string;
  hostEmail: string;
  archivedAt: string | null;
  imageId: string;
  url: string;
  sortOrder: number;
}
let connection: Connection | undefined;
async function main() {
  const apply = process.argv.includes('--apply');
  const target = new URL(process.env.DATABASE_URL!);
  if (apply) {
    const backup = process.env.VERIFIED_BACKUP_PATH!;
    const manifest = JSON.parse(
      fs.readFileSync(backup + '.manifest.json', 'utf8'),
    );
    const proof = JSON.parse(
      fs.readFileSync(backup + '.restore-verified.json', 'utf8'),
    );
    if (
      manifest.host !== target.hostname ||
      manifest.database !== target.pathname.slice(1) ||
      proof.backupSha256 !== manifest.sha256 ||
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(backup))
        .digest('hex') !== manifest.sha256
    )
      throw Error('MATCHING_VERIFIED_BACKUP_REQUIRED');
  }
  const desired = demoAccommodations.flatMap((p) => p.images.map((i) => i.url));
  if (desired.length !== 15 || new Set(desired).size !== 15)
    throw Error('FIFTEEN_DISTINCT_IMAGES_REQUIRED');
  connection = await connectDatabase();
  await connection.beginTransaction();
  const ids = demoAccommodations.map((p) => p.id);
  // Lock the exact fixtures and their images in one query; never touch financial tables.
  const [rows] = await connection.query<PhotoRow[]>(
    `
    SELECT p.id propertyId, p.name propertyName, u.email hostEmail, p.archivedAt,
      i.id imageId, i.url, i.sortOrder
    FROM Property p JOIN User u ON u.id=p.hostId JOIN PropertyImage i ON i.propertyId=p.id
    WHERE p.id IN (${ids.map(() => '?').join(',')}) ORDER BY p.id,i.sortOrder FOR UPDATE`,
    ids,
  );
  const changes: {
    property: string;
    imageId: string;
    sortOrder: number;
    from: string;
    to: string;
  }[] = [];
  for (const expected of demoAccommodations) {
    const current = rows.filter((r) => r.propertyId === expected.id);
    if (current.length !== 3) throw Error('EXPECTED_THREE_EXISTING_IMAGES');
    if (
      current.some(
        (p) =>
          p.propertyName !== expected.name ||
          p.hostEmail !== expected.hostEmail ||
          p.archivedAt,
      )
    )
      throw Error('FIXTURE_FINGERPRINT_MISMATCH');
    if (
      current.every(
        (image, i) =>
          image.sortOrder === i && image.url === expected.images[i].url,
      )
    )
      continue;
    if (
      !current.every(
        (image, i) =>
          image.sortOrder === i &&
          image.url === demoImageUrl(retiredDemoPhotoIds[i]),
      )
    )
      throw Error('CUSTOM_IMAGES_PRESERVED');
    for (const image of current)
      changes.push({
        property: expected.name,
        imageId: image.imageId,
        sortOrder: image.sortOrder,
        from: image.url,
        to: expected.images[image.sortOrder].url,
      });
  }
  if (apply && changes.length) {
    const parameters = changes.flatMap((i) => [i.imageId, i.to]);
    parameters.push(...changes.flatMap((i) => [i.imageId, i.from]));
    const [result] = await connection.query<ResultSetHeader>(
      `
      UPDATE PropertyImage SET url = CASE id ${changes.map(() => 'WHEN ? THEN ?').join(' ')} ELSE url END
      WHERE ${changes.map(() => '(id = ? AND url = ?)').join(' OR ')}`,
      parameters,
    );
    if (result.affectedRows !== changes.length)
      throw Error('CONCURRENT_IMAGE_CHANGE');
    await connection.commit();
  } else await connection.rollback();
  console.log(
    JSON.stringify({
      mode: apply ? 'apply' : 'preview',
      changes,
      imageCount: 15,
      distinctImageCount: new Set(desired).size,
    }),
  );
}
main()
  .catch(async (error) => {
    if (connection) await connection.rollback().catch(() => {});
    console.error(JSON.stringify(safeFailure(error)));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (connection) await connection.end();
  });
