import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initDb, pool } from '../src/db.js';
import { app } from '../src/index.js';

let server, baseUrl, userId, token;
const email = `test-${Date.now()}@sweety.local`;

before(async () => {
  process.env.JWT_SECRET ||= 'test-secret-that-is-long-enough-for-tests';
  await initDb();
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const hash = await bcrypt.hash('TestPassword123!', 4);
  const result = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id', ['API Test', email, hash]);
  userId = result.rows[0].id;
  token = jwt.sign({ sub: String(userId), name: 'API Test', email }, process.env.JWT_SECRET);
});
after(async () => {
  if (userId) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.end();
});

test('protected readings endpoint requires authentication', async () => {
  const response = await fetch(`${baseUrl}/api/readings`);
  assert.equal(response.status, 401);
});
test('creates and lists a reading for the authenticated owner', async () => {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const created = await fetch(`${baseUrl}/api/readings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ date, slot: 'morning', value: 111 })
  });
  assert.equal(created.status, 201);
  const list = await fetch(`${baseUrl}/api/readings?date=${date}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(list.status, 200);
  const data = await list.json();
  assert.ok(data.readings.some(r => r.value === 111 && r.slot === 'morning'));
});
