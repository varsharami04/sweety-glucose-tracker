import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool, initDb } from './db.js';
dotenv.config();

try {
  await initDb();
  const email = 'demo@sweety.local';
  const passwordHash = await bcrypt.hash('SweetyDemo123!', 12);
  const result = await pool.query(
    `INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3)
     ON CONFLICT(email) DO UPDATE
     SET name=EXCLUDED.name,
         password_hash=EXCLUDED.password_hash
     RETURNING id`,
    ['Demo User', email, passwordHash]
  );
  const userId = result.rows[0].id;
  await pool.query('DELETE FROM readings WHERE user_id=$1', [userId]);
  const now = new Date();
  const date = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today = date(now);
  const yesterdayDate = new Date(now); yesterdayDate.setDate(now.getDate()-1);
  const yesterday = date(yesterdayDate);
  const samples = [
    [yesterday, 'morning', 108],
    [yesterday, 'after_breakfast', 142],
    [yesterday, 'after_lunch', 126],
    [today, 'morning', 101],
    [today, 'after_breakfast', 137],
    [today, 'after_lunch', 119]
  ];
  for (const [readingDate, slot, value] of samples) {
    await pool.query('INSERT INTO readings(user_id,reading_date,slot,value) VALUES($1,$2::date,$3,$4)', [userId, readingDate, slot, value]);
  }
  console.log('Seed complete. Demo login: demo@sweety.local / SweetyDemo123!');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
