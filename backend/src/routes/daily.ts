import { Router } from 'express';
import { pool } from '../db';

const router = Router();

const PERIOD_MAP: Record<string, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '6m': '6 months',
};

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
  power AS (
    SELECT DATE(timestamp AT TIME ZONE 'Europe/Paris') AS day,
           SUM(pv_power) / 60 AS pv_wh,
           SUM(GREATEST(0, pv_power + grid_power)) / 60 AS consumption_wh,
           SUM(CASE WHEN ms2a_power + lifepe_power < 0 THEN ABS(ms2a_power + lifepe_power) ELSE 0 END) / 60 AS charge_wh,
           SUM(CASE WHEN ms2a_power + lifepe_power > 0 THEN ms2a_power + lifepe_power ELSE 0 END) / 60 AS discharge_wh
    FROM history
    WHERE timestamp >= NOW() - $1::interval
    GROUP BY 1
  )
  SELECT TO_CHAR(power.day, 'YYYY-MM-DD') AS day,
         ROUND((power.pv_wh / 1000)::numeric, 2) AS pv_yield_kwh,
         ROUND((power.consumption_wh / 1000)::numeric, 2) AS consumption_kwh,
         ROUND((COALESCE(linky.import_wh, 0) / 1000)::numeric, 2) AS linky_import_kwh,
         ROUND((COALESCE(linky.export_wh, 0) / 1000)::numeric, 2) AS linky_export_kwh,
         ROUND((power.charge_wh / 1000)::numeric, 2) AS charge_kwh,
         ROUND((power.discharge_wh / 1000)::numeric, 2) AS discharge_kwh
  FROM power
  LEFT JOIN linky ON linky.day = power.day
  ORDER BY power.day DESC`;

const FIELDS = ['pvYieldKwh', 'consumptionKwh', 'linkyImportKwh', 'linkyExportKwh', 'chargeKwh', 'dischargeKwh'] as const;

router.get('/daily', async (req, res) => {
  const period = (req.query.period as string) || '30d';
  const interval = PERIOD_MAP[period] || '30 days';

  try {
    const result = await pool.query(DAILY_QUERY, [interval]);

    const days = result.rows.map((row) => ({
      date: row.day as string,
      pvYieldKwh: parseFloat(row.pv_yield_kwh) || 0,
      consumptionKwh: parseFloat(row.consumption_kwh) || 0,
      linkyImportKwh: parseFloat(row.linky_import_kwh) || 0,
      linkyExportKwh: parseFloat(row.linky_export_kwh) || 0,
      chargeKwh: parseFloat(row.charge_kwh) || 0,
      dischargeKwh: parseFloat(row.discharge_kwh) || 0,
    }));

    const count = days.length || 1;
    const averages = { date: 'avg' } as Record<string, number | string>;
    for (const field of FIELDS) {
      averages[field] = Math.round(days.reduce((s, d) => s + d[field], 0) / count * 100) / 100;
    }

    res.json({ days, averages });
  } catch (error) {
    console.error('[Daily] Query failed:', error);
    res.status(500).json({ error: 'Failed to fetch daily history' });
  }
});

export const dailyRoutes = router;
