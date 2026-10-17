import fs from 'node:fs';
import crypto from 'node:crypto';
import { connectDatabase, safeFailure } from './database-connection.mjs';
let connection;
try {
  const manifest=JSON.parse(fs.readFileSync(process.argv[2]+'.manifest.json','utf8'));
  connection=await connectDatabase();
  const tables=[];
  for (const [table,expected] of Object.entries(manifest.tables)) {
    if (process.argv.includes('--financial-only') && !['Booking','Payment','Feedback'].includes(table)) continue;
    if(table==='_prisma_migrations'||(table==='User'&&process.argv.includes('--allow-name-repair'))) continue;
    const [rows]=await connection.query(`SELECT * FROM \`${table}\` ORDER BY 1`);
    if(rows.length!==expected.count||crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')!==expected.sha256) throw new Error('HISTORICAL_DATA_CHANGED');
    tables.push({table,count:rows.length,unchanged:true});
  }
  const [[integrity]]=await connection.query('SELECT (SELECT COUNT(*) FROM Booking b LEFT JOIN User u ON b.guestId=u.id LEFT JOIN RoomType r ON b.roomTypeId=r.id WHERE u.id IS NULL OR r.id IS NULL) orphanBookings,(SELECT COUNT(*) FROM Payment p LEFT JOIN Booking b ON p.bookingId=b.id WHERE b.id IS NULL) orphanPayments,(SELECT COUNT(*) FROM PaymentAttempt) attempts,(SELECT COUNT(*) FROM BookingEvent) events');
  if(integrity.orphanBookings||integrity.orphanPayments)throw new Error('RELATIONSHIP_INTEGRITY_FAILED');
  console.log(JSON.stringify({verified:true,tables,integrity}));
}catch(error){console.error(JSON.stringify(safeFailure(error)));process.exitCode=1;}
finally{if(connection)await connection.end();}
