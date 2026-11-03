export const SLOTS = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner'
};

export function validateReading({ date, slot, value }) {
  if (value === undefined || value === null || value === '') {
    return 'Please enter a glucose value.';
  }
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 40 || numericValue > 600) {
    return 'Value must be between 40 and 600 mg/dl.';
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Please select a valid date.';
  }
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return 'Please select a valid date.';
  }
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  if (date > todayString) return 'Date cannot be in the future.';
  if (!Object.hasOwn(SLOTS, slot)) return 'Please select a valid time slot.';
  return null;
}
