import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import { connectDatabase, safeFailure } from './database-connection.mjs';

// A logical snapshot contains credentials hashes and personal records. Keep it private.
const output = path.resolve(process.argv[2] ?? `../.local/aiven-${Date.now()}.sql`);
let connection;
try {
  connection = await connectDatabase();
  const [[{ db }]] = await connection.query('SELECT DATABASE() db');
  const [tls] = await connection.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
  if (!tls[0]?.Value && !['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('TLS_REQUIRED');
  await connection.query('SET SESSION TRANSACTION READ ONLY');
  await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const [tables] = await connection.query("SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  const manifest = { host: new URL(process.env.DATABASE_URL).hostname, database: db, createdAt: new Date().toISOString(), tls: tls[0]?.Value, tables: {} };
  const [[{ sqlMode }]] = await connection.query('SELECT @@SESSION.sql_mode sqlMode');
  const statements = ['SET NAMES utf8mb4;', `SET SESSION sql_mode=${mysql.escape(sqlMode)};`, 'SET FOREIGN_KEY_CHECKS=0;'];
  for (const { name } of tables) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('UNSUPPORTED_TABLE_NAME');
    const [ddl] = await connection.query(`SHOW CREATE TABLE \`${name}\``);
    statements.push(ddl[0]['Create Table'] + ';');
    const [rows, fields] = await connection.query(`SELECT * FROM \`${name}\` ORDER BY 1`);
    const columns = fields.map(f => '\`'+f.name+'\`').join(',');
    for (const row of rows) statements.push(`INSERT INTO \`${name}\` (${columns}) VALUES (${fields.map(f => mysql.escape(row[f.name])).join(',')});`);
    manifest.tables[name] = { count: rows.length, sha256: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
  }
  await connection.rollback();
  statements.push('SET FOREIGN_KEY_CHECKS=1;');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, statements.join('\n')+'\n', { flag: 'wx' });
  manifest.sha256 = crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
  fs.writeFileSync(output+'.manifest.json', JSON.stringify(manifest,null,2), { flag: 'wx' });
  console.log(JSON.stringify({ backup: output, manifest: output+'.manifest.json', database: db, tables: Object.fromEntries(Object.entries(manifest.tables).map(([n,t])=>[n,t.count])), sha256: manifest.sha256 }));
} catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode=1; }
finally { if(connection) await connection.end(); }
