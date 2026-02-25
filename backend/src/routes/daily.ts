import { Router } from 'express';
import { pool } from '../db';

const router = Router();

const PERIOD_MAP: Record<string, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '6m': '6 months',
};

router.get('/daily', async (req, res) => {
  const period = (req.query.period as string) || '30d';
  const interval = PERIOD_MAP[period] || '30 days';

  try {
    const result = await pool.query(
      `SELECT
        DATE(timestamp AT TIME ZONE 'Europe/Paris') AS day,
        ROUND((SUM(pv_power) / 60 / 1000)::numeric, 2) AS pv_yield_kwh,
        ROUND(((MAX(grid_import_wh) - MIN(grid_import_wh)) / 1000)::numeric, 2) AS grid_import_kwh,
        ROUND(((MAX(grid_export_wh) - MIN(grid_export_wh)) / 1000)::numeric, 2) AS grid_export_kwh,
        ROUND((SUM(CASE WHEN ms2a_power + lifepe_power < 0
          THEN ABS(ms2a_power + lifepe_power) / 60 ELSE 0 END) / 1000)::numeric, 2) AS charge_kwh,
        ROUND((SUM(CASE WHEN ms2a_power + lifepe_power > 0
          THEN (ms2a_power + lifepe_power) / 60 ELSE 0 END) / 1000)::numeric, 2) AS discharge_kwh,
        ROUND((SUM(CASE WHEN lifepe_power < 0
          THEN ABS(lifepe_power) / 60 ELSE 0 END) / 1000)::numeric, 2) AS lifepo_charge_kwh,
        ROUND((SUM(CASE WHEN lifepe_power > 0
          THEN lifepe_power / 60 ELSE 0 END) / 1000)::numeric, 2) AS lifepo_discharge_kwh
      FROM history
      WHERE timestamp >= NOW() - $1::interval
      GROUP BY DATE(timestamp AT TIME ZONE 'Europe/Paris')
      ORDER BY day DESC`,
      [interval],
    );

    const days = result.rows.map((row) => {
      const gridImport = parseFloat(row.grid_import_kwh) || 0;
      const gridExport = parseFloat(row.grid_export_kwh) || 0;
      const lifepoCharge = parseFloat(row.lifepo_charge_kwh) || 0;
      const lifepoDischarge = parseFloat(row.lifepo_discharge_kwh) || 0;

      return {
        date: row.day.toISOString().slice(0, 10),
        pvYieldKwh: parseFloat(row.pv_yield_kwh) || 0,
        gridImportKwh: Math.max(0, Math.round((gridImport - lifepoDischarge) * 100) / 100),
        gridExportKwh: Math.max(0, Math.round((gridExport - lifepoCharge) * 100) / 100),
        chargeKwh: parseFloat(row.charge_kwh) || 0,
        dischargeKwh: parseFloat(row.discharge_kwh) || 0,
      };
    });

    // Moyennes
    const count = days.length || 1;
    const averages = {
      date: 'avg',
      pvYieldKwh: Math.round(days.reduce((s, d) => s + d.pvYieldKwh, 0) / count * 100) / 100,
      gridImportKwh: Math.round(days.reduce((s, d) => s + d.gridImportKwh, 0) / count * 100) / 100,
      gridExportKwh: Math.round(days.reduce((s, d) => s + d.gridExportKwh, 0) / count * 100) / 100,
      chargeKwh: Math.round(days.reduce((s, d) => s + d.chargeKwh, 0) / count * 100) / 100,
      dischargeKwh: Math.round(days.reduce((s, d) => s + d.dischargeKwh, 0) / count * 100) / 100,
    };

    res.json({ days, averages });
  } catch (error) {
    console.error('[Daily] Query failed:', error);
    res.status(500).json({ error: 'Failed to fetch daily history' });
  }
});

export const dailyRoutes = router;
