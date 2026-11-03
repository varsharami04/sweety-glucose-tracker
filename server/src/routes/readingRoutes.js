import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { SLOTS, validateReading } from '../validation.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const params = [req.user.id];
    let sql = `SELECT id, to_char(reading_date, 'YYYY-MM-DD') AS date, slot, value,
                      created_at, updated_at FROM readings WHERE user_id = $1`;
    if (req.query.date) { params.push(req.query.date); sql += ` AND reading_date = $${params.length}::date`; }
    sql += ' ORDER BY reading_date DESC, CASE slot WHEN \'morning\' THEN 1 WHEN \'after_breakfast\' THEN 2 WHEN \'after_lunch\' THEN 3 ELSE 4 END';
    const result = await pool.query(sql, params);
    res.json({ readings: result.rows.map(r => ({ ...r, value: Number(r.value), slotLabel: SLOTS[r.slot] })) });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const error = validateReading(req.body || {});
    if (error) return res.status(400).json({ error });
    const { date, slot, value } = req.body;
    const count = await pool.query('SELECT COUNT(*)::int AS count FROM readings WHERE user_id=$1 AND reading_date=$2::date', [req.user.id, date]);
    if (count.rows[0].count >= 4) return res.status(400).json({ error: 'You can add only 4 readings per day.' });
    const duplicate = await pool.query('SELECT 1 FROM readings WHERE user_id=$1 AND reading_date=$2::date AND slot=$3', [req.user.id, date, slot]);
    if (duplicate.rowCount) return res.status(409).json({ error: `You already have a ${SLOTS[slot]} reading for this date.` });
    const result = await pool.query(
      `INSERT INTO readings(user_id, reading_date, slot, value) VALUES($1,$2::date,$3,$4)
       RETURNING id, to_char(reading_date, 'YYYY-MM-DD') AS date, slot, value`,
      [req.user.id, date, slot, Number(value)]
    );
    res.status(201).json({ reading: { ...result.rows[0], value: Number(result.rows[0].value), slotLabel: SLOTS[slot] } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `You already have a ${SLOTS[req.body?.slot] || 'time slot'} reading for this date.` });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const error = validateReading(req.body || {});
    if (error) return res.status(400).json({ error });
    const { date, slot, value } = req.body;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid reading ID.' });
    const existing = await pool.query('SELECT id FROM readings WHERE id=$1 AND user_id=$2', [id, req.user.id]);
    if (!existing.rowCount) return res.status(404).json({ error: 'Reading not found.' });
    const duplicate = await pool.query('SELECT 1 FROM readings WHERE user_id=$1 AND reading_date=$2::date AND slot=$3 AND id<>$4', [req.user.id, date, slot, id]);
    if (duplicate.rowCount) return res.status(409).json({ error: `You already have a ${SLOTS[slot]} reading for this date.` });
    const count = await pool.query('SELECT COUNT(*)::int AS count FROM readings WHERE user_id=$1 AND reading_date=$2::date AND id<>$3', [req.user.id, date, id]);
    if (count.rows[0].count >= 4) return res.status(400).json({ error: 'You can add only 4 readings per day.' });
    const result = await pool.query(
      `UPDATE readings SET reading_date=$1::date, slot=$2, value=$3, updated_at=NOW()
       WHERE id=$4 AND user_id=$5
       RETURNING id, to_char(reading_date, 'YYYY-MM-DD') AS date, slot, value`,
      [date, slot, Number(value), id, req.user.id]
    );
    res.json({ reading: { ...result.rows[0], value: Number(result.rows[0].value), slotLabel: SLOTS[slot] } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `You already have a ${SLOTS[req.body?.slot] || 'time slot'} reading for this date.` });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM readings WHERE id=$1 AND user_id=$2 RETURNING id', [Number(req.params.id), req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Reading not found.' });
    res.json({ message: 'Reading deleted successfully.' });
  } catch (err) { next(err); }
});
export default router;
