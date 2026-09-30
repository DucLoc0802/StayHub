import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const [example, target] of [
  ['backend/.env.example', 'backend/.env'],
  ['frontend/.env.example', 'frontend/.env.local'],
]) {
  const destination = path.join(root, target);
  if (fs.existsSync(destination)) {
    console.info(`${target} already exists; kept unchanged.`);
    continue;
  }
  const content = fs
    .readFileSync(path.join(root, example), 'utf8')
    .replace(
      'replace-with-a-random-secret-of-at-least-32-characters',
      crypto.randomBytes(32).toString('hex'),
    );
  fs.writeFileSync(destination, content, { mode: 0o600 });
  console.info(`Created ${target}.`);
}
