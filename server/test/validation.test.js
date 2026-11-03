import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReading } from '../src/validation.js';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

test('requires a value', () => {
  assert.equal(validateReading({ date: today(), slot: 'morning', value: '' }), 'Please enter a glucose value.');
});
test('rejects values outside 40–600 and decimals', () => {
  assert.match(validateReading({ date: today(), slot: 'morning', value: 39 }) || '', /40 and 600/);
  assert.match(validateReading({ date: today(), slot: 'morning', value: 80.5 }) || '', /40 and 600/);
});
test('accepts valid reading payload', () => {
  assert.equal(validateReading({ date: today(), slot: 'after_lunch', value: 120 }), null);
});
test('rejects future date', () => {
  assert.equal(validateReading({ date: '2999-01-01', slot: 'morning', value: 100 }), 'Date cannot be in the future.');
});
