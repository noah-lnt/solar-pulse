import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDaylight, nextPollAfterSuccess, backoffDelay } from './hoymiles.schedule';

const PARIS = { lat: 48.8566, lon: 2.3522 };
const daylight = (iso: string) => isDaylight(new Date(iso), PARIS.lat, PARIS.lon);

test('winter solstice: day between ~08:40 and ~16:55 Paris time', () => {
  assert.equal(daylight('2026-12-21T08:00:00+01:00'), false);
  assert.equal(daylight('2026-12-21T12:00:00+01:00'), true);
  assert.equal(daylight('2026-12-21T16:30:00+01:00'), true);
  assert.equal(daylight('2026-12-21T17:30:00+01:00'), false);
  assert.equal(daylight('2026-12-21T23:30:00+01:00'), false);
});

test('summer solstice: day between ~05:45 and ~21:58 Paris time', () => {
  assert.equal(daylight('2026-06-21T05:15:00+02:00'), false);
  assert.equal(daylight('2026-06-21T06:30:00+02:00'), true);
  assert.equal(daylight('2026-06-21T21:30:00+02:00'), true);
  assert.equal(daylight('2026-06-21T22:30:00+02:00'), false);
  assert.equal(daylight('2026-06-22T01:00:00+02:00'), false);
});

test('next poll after a success is 5 minutes later', () => {
  assert.equal(nextPollAfterSuccess(1_000_000), 1_000_000 + 5 * 60_000);
});

test('backoff doubles from 30 min and caps at 6 h', () => {
  const minutes = [1, 2, 3, 4, 5, 6, 10].map((n) => backoffDelay(n) / 60_000);
  assert.deepEqual(minutes, [30, 60, 120, 240, 360, 360, 360]);
});
