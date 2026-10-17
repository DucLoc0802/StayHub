import fs from 'node:fs';
import crypto from 'node:crypto';
import { connectDatabase, safeFailure } from './database-connection.mjs';
let connection;
try {
  const dump = process.argv[2], manifest = JSON.parse(fs.readFileSync(dump+'.manifest.json','utf8'));
  const url = new URL(process.env.REHEARSAL_DATABASE_URL);
  if (!['127.0.0.1','localhost'].includes(url.hostname) || !/^stayhub_.*_rehearsal_test$/.test(url.pathname.slice(1))) throw new Error('ISOLATED_REHEARSAL_REQUIRED');
  if (crypto.createHash('sha256').update(fs.readFileSync(dump)).digest('hex')!==manifest.sha256) throw new Error('BACKUP_CHECKSUM_MISMATCH');
  connection = await connectDatabase(url.href,{ database:undefined,multipleStatements:true });
  const name = url.pathname.slice(1);
  const [existing] = await connection.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[name]);
  if (existing.length) throw new Error('REHEARSAL_DATABASE_ALREADY_EXISTS');
  await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.changeUser({ database: name });
  await connection.query(fs.readFileSync(dump,'utf8'));
  for (const [table, expected] of Object.entries(manifest.tables)) {
    const [rows] = await connection.query(`SELECT * FROM \`${table}\` ORDER BY 1`);
    if (rows.length !== expected.count || crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') !== expected.sha256) throw new Error('RESTORE_VERIFICATION_FAILED');
  }
  fs.writeFileSync(dump+'.restore-verified.json', JSON.stringify({ backupSha256:manifest.sha256, target:name, verifiedAt:new Date().toISOString(), tables:Object.keys(manifest.tables).length }));
  console.log(JSON.stringify({ restored:true, verified:true, database:name, tables:Object.keys(manifest.tables).length }));
} catch(error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode=1; }
finally { if(connection) await connection.end(); }
