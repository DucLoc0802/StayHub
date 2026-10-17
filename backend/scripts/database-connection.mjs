import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
export function databaseConfig(value, extra = {}) {
  const url = new URL(value);
  if (url.protocol !== 'mysql:') throw new Error('MYSQL_URL_REQUIRED');
  const sslaccept = url.searchParams.get('sslaccept'), cert = url.searchParams.get('sslcert');
  return { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), connectTimeout: 15000, charset: 'utf8mb4', dateStrings: true,
    ...(sslaccept || cert ? { ssl: { rejectUnauthorized: sslaccept !== 'accept_invalid_certs', ...(cert ? { ca: fs.readFileSync(path.resolve('prisma', cert)) } : {}) } } : {}), ...extra };
}
export const connectDatabase = (value = process.env.DATABASE_URL, extra) => mysql.createConnection(databaseConfig(value, extra));
export const safeFailure = error => ({ error: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : /^[A-Z0-9_]+$/.test(error.message ?? '') ? error.message : 'DATABASE_OPERATION_FAILED' });
