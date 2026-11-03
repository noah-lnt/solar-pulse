process.env.TZ = 'Europe/Paris';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunWindows } from './sun';
import { isDaylight } from './collectors/hoymiles.schedule';

const SITES = [
  { name: 'Paris', latitude: 48.8566, longitude: 2.3522 },
  { name: 'demo (0, 0)', latitude: 0, longitude: 0 },
];

const DAYS = [
  new Date(2026, 0, 15),
  new Date(2026, 2, 29), // DST starts
  new Date(2026, 5, 21),
  new Date(2026, 9, 25), // DST ends
];

for (const site of SITES) {
  for (const day of DAYS) {
    test(`${site.name}, ${day.toDateString()}: every minute matches isDaylight`, () => {
      const [{ sunrise, sunset }] = sunWindows(1, site.latitude, site.longitude, day);
      assert.ok(sunrise && sunset);
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      for (let t = new Date(day); t < end; t = new Date(t.getTime() + 60_000)) {
        assert.equal(t >= sunrise && t < sunset, isDaylight(t, site.latitude, site.longitude), t.toISOString());
      }
    });
  }
}

test('one window per day, today first', () => {
  const windows = sunWindows(8, 48.8566, 2.3522, new Date(2026, 10, 3, 9, 30));
  assert.equal(windows.length, 8);
  assert.deepEqual(
    windows.map((w) => w.sunrise?.toLocaleDateString('fr-FR')),
    ['03/11/2026', '02/11/2026', '01/11/2026', '31/10/2026', '30/10/2026', '29/10/2026', '28/10/2026', '27/10/2026'],
  );
});
