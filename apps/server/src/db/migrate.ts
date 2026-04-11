import fs from 'fs';
import path from 'path';
import pg from 'postgres';
import { config } from 'dotenv';

config();

const sql = pg(process.env.DATABASE_URL || 'postgresql://uli:uli123@localhost:5432/uli');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  console.log('[migrate] running schema...');
  await sql.unsafe(schema);
  console.log('[migrate] done!');

  await sql.end();
}

migrate().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
