import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

let connection;
try {
  const url = new URL(process.env.DATABASE_URL);
  const sslaccept = url.searchParams.get('sslaccept');
  const sslcert = url.searchParams.get('sslcert');
  connection = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectTimeout: 15000,
    ...(sslaccept || sslcert
      ? {
          ssl: {
            rejectUnauthorized: sslaccept !== 'accept_invalid_certs',
            ...(sslcert
              ? { ca: fs.readFileSync(path.resolve('prisma', sslcert)) }
              : {}),
          },
        }
      : {}),
  });
  const [tls] = await connection.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
  const [tables] = await connection.query('SHOW TABLES');
  console.log(
    JSON.stringify({
      connected: true,
      tls: tls[0]?.Value || null,
      tableCount: tables.length,
    }),
  );
} catch (error) {
  // Driver errors may contain connection details; print only the error code.
  console.error(
    JSON.stringify({
      connected: false,
      code: error.code || 'CONNECTION_FAILED',
    }),
  );
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
