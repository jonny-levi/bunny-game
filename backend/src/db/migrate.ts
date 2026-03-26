import fs from 'fs';
import path from 'path';
import { pool } from './pool';

async function migrate() {
  const sql = fs.readFileSync(
    path.join(__dirname, 'migrations', '001_init.sql'),
    'utf-8'
  );
  try {
    await pool.query(sql);
    console.log('✅ Migration complete');
  } catch (err: any) {
    if (err.code === '42P07') {
      console.log('⏭️  Tables already exist, skipping');
    } else {
      throw err;
    }
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
