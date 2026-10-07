import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarAvailability } from '../../frontend/src/lib/calendar-availability';
test('calendar conveys backend counts with colors and Vietnamese labels', () => {
  for (const n of [5, 8, 10])
    assert.equal(calendarAvailability(n).tone, 'green');
  for (const n of [3, 4]) assert.equal(calendarAvailability(n).tone, 'yellow');
  for (const n of [1, 2]) assert.equal(calendarAvailability(n).tone, 'red');
  assert.deepEqual(calendarAvailability(0), {
    tone: 'sold-out',
    label: 'Hết phòng',
  });
  assert.equal(calendarAvailability(undefined).tone, 'unknown');
  assert.match(calendarAvailability(1).label, /1 đến 2/);
});
