import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  path.join(root, '.local/mysql/mysql-8.4.11-winx64/bin/mysqladmin.exe'),
  [`--defaults-file=${path.join(root, '.local/mysql-admin.cnf')}`, 'shutdown'],
  { windowsHide: true, stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
