import { SystemState, HistoryPoint, ShellyData, VictronData, LiFePO4DiyData } from './collectors/types';
import { collectHoymiles } from './collectors/hoymiles.collector';
import { collectShelly } from './collectors/shelly.collector';
import { collectVictron, collectLiFePO4 } from './collectors/victron.collector';
import { pool } from './db';
import { computeEnergyFlows } from './energy';

const MAX_MEMORY_POINTS = 1440; // 24h in memory for fast access
const history: HistoryPoint[] = [];
let lastHistoryMinute = -1;
let currentState: SystemState | null = null;

const defaultGrid: ShellyData = {
  phases: [
    { voltage: 0, current: 0, power: 0, apparentPower: 0, powerFactor: 0, frequency: 0 },
    { voltage: 0, current: 0, power: 0, apparentPower: 0, powerFactor: 0, frequency: 0 },
    { voltage: 0, current: 0, power: 0, apparentPower: 0, powerFactor: 0, frequency: 0 },
  ],
  totalPower: 0, totalImportWh: 0, totalExportWh: 0,
};

const defaultVictron: VictronData = {
  mode: 'off', inputVoltage: 0, inputFrequency: 0, outputVoltage: 0, outputFrequency: 0, outputPower: 0, loadPercent: 0, warnings: [], alarms: [],
};

const defaultLifepo: LiFePO4DiyData = {
  soc: 0, power: 0, voltage: 0, current: 0, temperature: 0, capacityWh: 32000, status: 'offline', cycles: 0,
  cellVoltages: [], cellCount: 0, bmsTemperature: 0, balancing: false, minCellVoltage: 0, maxCellVoltage: 0, cellDelta: 0,
  batteryPacks: [],
};

// Cache des dernieres valeurs connues pour chaque collecteur
const lastKnown: Record<string, unknown> = {};

async function safeCollect<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const result = await fn();
    lastKnown[name] = result;
    return result;
  } catch (error) {
    console.error(`[Aggregator] ${name} failed:`, error instanceof Error ? error.message : error);
    // Retourner les dernieres valeurs connues si disponibles (evite les 0 temporaires)
    if (lastKnown[name] !== undefined) {
      console.warn(`[Aggregator] ${name}: using last known values`);
      return lastKnown[name] as T;
    }
    return fallback;
  }
}

// ── History persistence (stockage infini) ──

export async function loadHistory(): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT timestamp, pv_power, grid_power, battery_power, consumption,
              grid_import_wh, grid_export_wh,
              lifepe_soc, lifepe_power, victron_mode
       FROM history
       WHERE timestamp > NOW() - INTERVAL '24 hours'
       ORDER BY timestamp ASC
       LIMIT $1`,
      [MAX_MEMORY_POINTS],
    );

    history.length = 0;
    for (const row of result.rows) {
      history.push({
        timestamp: row.timestamp.toISOString(),
        pvPower: row.pv_power,
        gridPower: row.grid_power,
        batteryPower: row.battery_power,
        consumption: row.consumption,
        gridImportWh: row.grid_import_wh ?? 0,
        gridExportWh: row.grid_export_wh ?? 0,
        lifepeSoc: row.lifepe_soc ?? 0,
        lifepePower: row.lifepe_power ?? 0,
        victronMode: row.victron_mode ?? 'off',
      });
    }

    if (history.length > 0) {
      const lastTs = new Date(history[history.length - 1].timestamp);
      lastHistoryMinute = lastTs.getHours() * 60 + lastTs.getMinutes();
    }

    console.log(`[Aggregator] Loaded ${history.length} history points from database`);
  } catch (error) {
    console.error('[Aggregator] Failed to load history:', error instanceof Error ? error.message : error);
  }
}

async function saveHistoryPoint(point: HistoryPoint): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO history (timestamp, pv_power, grid_power, battery_power, consumption,
                            grid_import_wh, grid_export_wh,
                            lifepe_soc, lifepe_power, victron_mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        point.timestamp, point.pvPower, point.gridPower, point.batteryPower, point.consumption,
        point.gridImportWh, point.gridExportWh,
        point.lifepeSoc, point.lifepePower, point.victronMode,
      ],
    );
  } catch (error) {
    console.error('[Aggregator] Failed to save history point:', error instanceof Error ? error.message : error);
  }
}

// Pas de cleanup — stockage infini en base de donnees

// ── Aggregation ──

export async function aggregate(): Promise<SystemState> {
  const pv = await collectHoymiles(new Date());
  const grid = await safeCollect('Shelly', () => collectShelly(pv.powerNow), defaultGrid);
  const victron = await safeCollect('Victron', () => collectVictron(pv.powerNow, grid.totalPower), defaultVictron);
  const lifepoDiy = await safeCollect('LiFePO4', () => collectLiFePO4(victron.mode, victron.outputPower), defaultLifepo);

  const lifepoOnline = lifepoDiy.status !== 'offline';
  const totalBatteryPower = lifepoOnline ? lifepoDiy.power : 0;
  const totalBatterySoc = lifepoOnline ? lifepoDiy.soc : 0;

  const flows = computeEnergyFlows(pv.powerNow, grid.totalPower, victron.mode);

  const state: SystemState = {
    timestamp: new Date().toISOString(),
    pv,
    lifepoDiy,
    victron,
    grid,
    computed: {
      ...flows,
      totalBatteryPower: Math.round(totalBatteryPower),
      totalBatterySoc: Math.round(totalBatterySoc * 10) / 10,
    },
  };

  currentState = state;

  const nowDate = new Date();
  const currentMinute = nowDate.getHours() * 60 + nowDate.getMinutes();
  if (currentMinute !== lastHistoryMinute) {
    lastHistoryMinute = currentMinute;
    const point: HistoryPoint = {
      timestamp: state.timestamp,
      pvPower: pv.powerNow,
      gridPower: grid.totalPower,
      batteryPower: totalBatteryPower,
      consumption: flows.consumption,
      gridImportWh: grid.totalImportWh,
      gridExportWh: grid.totalExportWh,
      lifepeSoc: lifepoDiy.soc,
      lifepePower: lifepoDiy.power,
      victronMode: victron.mode,
    };
    history.push(point);
    if (history.length > MAX_MEMORY_POINTS) {
      history.shift();
    }
    saveHistoryPoint(point);
  }

  return state;
}

export function getCurrentState(): SystemState | null {
  return currentState;
}

export function getHistory(): HistoryPoint[] {
  return [...history];
}
