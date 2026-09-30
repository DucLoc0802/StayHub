// Optional Windows fallback for this workspace when Docker is unavailable.
// Download/extract official MySQL 8.4.11 ZIP under .local/mysql before using.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, '.local/mysql/mysql-8.4.11-winx64');
const data = path.join(root, '.local/mysql-data');
const bin = path.join(base, 'bin');
const adminConfig = path.join(root, '.local/mysql-admin.cnf');
const server = path.join(bin, 'mysqld.exe');
if (!fs.existsSync(server))
  throw new Error(
    'MySQL portable missing. Use docker compose up -d mysql, or extract the official ZIP into .local/mysql.',
  );
const initialized = fs.existsSync(path.join(data, 'mysql'));
if (!initialized) {
  const init = spawnSync(
    server,
    [
      '--no-defaults',
      '--initialize-insecure',
      `--basedir=${base}`,
      `--datadir=${data}`,
      '--console',
    ],
    { windowsHide: true, stdio: 'inherit' },
  );
  if (init.status !== 0) process.exit(init.status ?? 1);
}
const available = () =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 3307 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
if (await available())
  throw new Error(
    'Port 3307 already occupied. Existing service was left unchanged.',
  );
const log = fs.openSync(path.join(root, '.local/mysql-console.log'), 'a');
const child = spawn(
  server,
  [
    '--no-defaults',
    `--basedir=${base}`,
    `--datadir=${data}`,
    '--bind-address=127.0.0.1',
    '--port=3307',
    '--mysqlx=0',
    '--console',
  ],
  { windowsHide: true, stdio: ['ignore', log, log] },
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
process.on('SIGINT', () => {
  child.kill();
});
fs.closeSync(log);
fs.writeFileSync(path.join(root, '.local/mysql.pid'), String(child.pid));
for (let i = 0; i < 60 && !(await available()); i++)
  await new Promise((resolve) => setTimeout(resolve, 500));
if (!(await available()))
  throw new Error('MySQL did not become ready. See .local/mysql-console.log.');
if (!fs.existsSync(adminConfig)) {
  const password = crypto.randomBytes(24).toString('hex');
  const sql = `CREATE DATABASE IF NOT EXISTS stayhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'stayhub'@'localhost' IDENTIFIED BY 'stayhub'; GRANT ALL PRIVILEGES ON stayhub.* TO 'stayhub'@'localhost'; ALTER USER 'root'@'localhost' IDENTIFIED BY '${password}';`;
  const result = spawnSync(
    path.join(bin, 'mysql.exe'),
    ['--no-defaults', '-h', '127.0.0.1', '-P', '3307', '-u', 'root'],
    { input: sql, encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  fs.writeFileSync(
    adminConfig,
    `[client]\nuser=root\npassword=${password}\nhost=127.0.0.1\nport=3307\n`,
    { mode: 0o600 },
  );
}
console.info(
  'Local MySQL ready at 127.0.0.1:3307. No Windows service installed.',
);
