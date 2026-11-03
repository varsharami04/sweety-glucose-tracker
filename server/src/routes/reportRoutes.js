import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { SLOTS } from '../validation.js';

const router = Router();
router.use(requireAuth);

function validDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}
function ranges(date, kind) {
  const [year, month, day] = date.split('-').map(Number);
  const selected = new Date(year, month - 1, day);
  if (kind === 'daily') return { start: date, end: date, label: date };
  if (kind === 'month-to-date') return { start: `${year}-${String(month).padStart(2,'0')}-01`, end: date, label: `${year}-${String(month).padStart(2,'0')}-01 – ${date}` };
  const firstCurrent = new Date(year, month - 1, 1);
  const lastPrevious = new Date(firstCurrent.getTime() - 86400000);
  const firstPrevious = new Date(lastPrevious.getFullYear(), lastPrevious.getMonth(), 1);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: fmt(firstPrevious), end: fmt(lastPrevious), label: `${fmt(firstPrevious)} – ${fmt(lastPrevious)}` };
}
router.get('/:kind', async (req, res, next) => {
  try {
    const kind = req.params.kind;
    if (!['daily', 'month-to-date', 'previous-month'].includes(kind)) return res.status(404).json({ error: 'Report not found.' });
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    if (!validDate(date)) return res.status(400).json({ error: 'Please select a valid report date.' });
    const range = ranges(date, kind);
    const result = await pool.query(
      `SELECT id, to_char(reading_date, 'YYYY-MM-DD') AS date, slot, value
       FROM readings WHERE user_id=$1 AND reading_date BETWEEN $2::date AND $3::date
       ORDER BY reading_date, CASE slot WHEN 'morning' THEN 1 WHEN 'after_breakfast' THEN 2 WHEN 'after_lunch' THEN 3 ELSE 4 END`,
      [req.user.id, range.start, range.end]
    );
    const readings = result.rows.map(r => ({ ...r, value: Number(r.value), slotLabel: SLOTS[r.slot] }));
    const values = readings.map(r => r.value);
    const summary = values.length ? {
      highest: Math.max(...values),
      lowest: Math.min(...values),
      average: Math.round(values.reduce((a,b) => a+b, 0) / values.length * 10) / 10,
      count: values.length
    } : null;
    res.json({ kind, selectedDate: date, startDate: range.start, endDate: range.end, rangeLabel: range.label, summary, readings: kind === 'daily' ? readings : undefined });
  } catch (err) { next(err); }
});
export default router;
