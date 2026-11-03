import { Router } from 'express';
import { pool } from '../db';
import { config } from '../config';
import { sunWindows } from '../sun';

const router = Router();

// `days`: calendar days the interval can touch, today included (6 months reach back up to 184 days).
const PERIODS: Record<string, { interval: string; days: number }> = {
  '7d': { interval: '7 days', days: 8 },
  '30d': { interval: '30 days', days: 31 },
  '6m': { interval: '6 months', days: 185 },
};

const SLICES = ['total', 'linky', 'victron', 'night', 'day'] as const;
type Slice = (typeof SLICES)[number];

// Shelly counters belong to the Linky only while the Victron is OFF (ON = island, the Shelly
// then measures the Victron line). A counter at 0 means the Shelly was unreachable: skip it,
// or the next delta would be its whole lifetime total.
const DAILY_QUERY = `
  WITH counters AS (
    SELECT timestamp, victron_mode,
           grid_import_wh - LAG(grid_import_wh) OVER (ORDER BY timestamp) AS import_delta,
           grid_export_wh - LAG(grid_export_wh) OVER (ORDER BY timestamp) AS export_delta
    FROM history
    WHERE timestamp >= NOW() - $1::interval AND grid_import_wh > 0 AND grid_export_wh > 0
  ),
  linky AS (
    SELECT DATE(timestamp AT TIME ZONE 'Europe/Paris') AS day,
           SUM(GREATEST(0, import_delta)) AS import_wh,
           SUM(GREATEST(0, export_delta)) AS export_wh
    FROM counters
    WHERE victron_mode = 'off'
    GROUP BY 1
  ),
  sun AS (
    SELECT DATE(sunrise AT TIME ZONE 'Europe/Paris') AS sun_day, sunrise, sunset
    FROM unnest($2::timestamptz[], $3::timestamptz[]) AS s(sunrise, sunset)
  ),
  power AS (
    SELECT DATE(timestamp AT TIME ZONE 'Europe/Paris') AS day,
           SUM(pv_power) / 60 AS pv_wh,
           SUM(GREATEST(0, pv_power + grid_power)) / 60 AS consumption_wh,
           SUM(CASE WHEN ms2a_power + lifepe_power < 0 THEN ABS(ms2a_power + lifepe_power) ELSE 0 END) / 60 AS charge_wh,
           SUM(CASE WHEN ms2a_power + lifepe_power > 0 THEN ms2a_power + lifepe_power ELSE 0 END) / 60 AS discharge_wh,
           COUNT(*) AS total_minutes,
           SUM(GREATEST(0, pv_power + grid_power)) FILTER (WHERE victron_mode = 'off') / 60 AS linky_wh,
           COUNT(*) FILTER (WHERE victron_mode = 'off') AS linky_minutes,
           SUM(GREATEST(0, pv_power + grid_power)) FILTER (WHERE victron_mode <> 'off') / 60 AS victron_wh,
           COUNT(*) FILTER (WHERE victron_mode <> 'off') AS victron_minutes,
           SUM(GREATEST(0, pv_power + grid_power)) FILTER (WHERE timestamp < sunrise OR timestamp >= sunset) / 60 AS night_wh,
           COUNT(*) FILTER (WHERE timestamp < sunrise OR timestamp >= sunset) AS night_minutes,
           SUM(GREATEST(0, pv_power + grid_power)) FILTER (WHERE timestamp >= sunrise AND timestamp < sunset) / 60 AS day_wh,
           COUNT(*) FILTER (WHERE timestamp >= sunrise AND timestamp < sunset) AS day_minutes
    FROM history
    LEFT JOIN sun ON sun_day = DATE(timestamp AT TIME ZONE 'Europe/Paris')
    WHERE timestamp >= NOW() - $1::interval
    GROUP BY 1
  )
  SELECT TO_CHAR(power.day, 'YYYY-MM-DD') AS day,
         ROUND((power.pv_wh / 1000)::numeric, 2) AS pv_yield_kwh,
         ROUND((power.consumption_wh / 1000)::numeric, 2) AS consumption_kwh,
         ROUND((COALESCE(linky.import_wh, 0) / 1000)::numeric, 2) AS linky_import_kwh,
         ROUND((COALESCE(linky.export_wh, 0) / 1000)::numeric, 2) AS linky_export_kwh,
         ROUND((power.charge_wh / 1000)::numeric, 2) AS charge_kwh,
         ROUND((power.discharge_wh / 1000)::numeric, 2) AS discharge_kwh,
         power.consumption_wh AS total_wh, power.total_minutes,
         power.linky_wh, power.linky_minutes,
         power.victron_wh, power.victron_minutes,
         power.night_wh, power.night_minutes,
         power.day_wh, power.day_minutes
  FROM power
  LEFT JOIN linky ON linky.day = power.day
  ORDER BY power.day DESC`;

const FIELDS = ['pvYieldKwh', 'consumptionKwh', 'linkyImportKwh', 'linkyExportKwh', 'chargeKwh', 'dischargeKwh'] as const;

function toSlice(wh: number, minutes: number) {
  return {
    avgW: minutes > 0 ? Math.round((wh * 60) / minutes) : 0,
    kwh: Math.round(wh / 10) / 100,
    minutes: Math.round(minutes),
  };
}

function sliceMap<T>(fn: (slice: Slice) => T): Record<Slice, T> {
  return Object.fromEntries(SLICES.map((slice) => [slice, fn(slice)])) as Record<Slice, T>;
}

router.get('/daily', async (req, res) => {
  const period = (req.query.period as string) || '30d';
  const { interval, days: dayCount } = PERIODS[period] || PERIODS['30d'];
  const sun = sunWindows(dayCount, config.siteLatitude, config.siteLongitude);

  try {
    const result = await pool.query(DAILY_QUERY, [interval, sun.map((w) => w.sunrise), sun.map((w) => w.sunset)]);
    const raw = result.rows.map((row) => sliceMap((slice) => ({
      wh: parseFloat(row[`${slice}_wh`]) || 0,
      minutes: Number(row[`${slice}_minutes`]) || 0,
    })));

    const days = result.rows.map((row, i) => ({
      date: row.day as string,
      pvYieldKwh: parseFloat(row.pv_yield_kwh) || 0,
      consumptionKwh: parseFloat(row.consumption_kwh) || 0,
      linkyImportKwh: parseFloat(row.linky_import_kwh) || 0,
      linkyExportKwh: parseFloat(row.linky_export_kwh) || 0,
      chargeKwh: parseFloat(row.charge_kwh) || 0,
      dischargeKwh: parseFloat(row.discharge_kwh) || 0,
      consumptionSlices: sliceMap((slice) => toSlice(raw[i][slice].wh, raw[i][slice].minutes)),
    }));

    const count = days.length || 1;
    const averages = { date: 'avg' } as Record<string, unknown>;
    for (const field of FIELDS) {
      averages[field] = Math.round(days.reduce((s, d) => s + d[field], 0) / count * 100) / 100;
    }
    averages.consumptionSlices = sliceMap((slice) => toSlice(
      raw.reduce((s, r) => s + r[slice].wh, 0) / count,
      raw.reduce((s, r) => s + r[slice].minutes, 0) / count,
    ));

    res.json({ days, averages });
  } catch (error) {
    console.error('[Daily] Query failed:', error);
    res.status(500).json({ error: 'Failed to fetch daily history' });
  }
});

export const dailyRoutes = router;
