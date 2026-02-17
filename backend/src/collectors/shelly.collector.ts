import { ShellyData, ShellyPhase, CollectorStatus } from './types';
import { config } from '../config';

let status: CollectorStatus = {
  name: 'Shelly Pro 3EM',
  connected: false,
  lastUpdate: null,
  errorCount: 0,
  lastError: null,
};

function randomVariation(base: number, percent: number): number {
  return base + base * (Math.random() - 0.5) * 2 * (percent / 100);
}

function generateDemoPhase(basePower: number): ShellyPhase {
  const power = randomVariation(basePower, 15);
  const voltage = randomVariation(230, 2);
  const current = Math.abs(power) / voltage;
  const apparentPower = voltage * current;
  const powerFactor = Math.abs(power) / (apparentPower || 1);

  return {
    voltage: Math.round(voltage * 10) / 10,
    current: Math.round(current * 100) / 100,
    power: Math.round(power),
    apparentPower: Math.round(apparentPower),
    powerFactor: Math.round(Math.min(powerFactor, 1) * 100) / 100,
    frequency: randomVariation(50, 0.2),
  };
}

let totalImportWh = 15000;
let totalExportWh = 8000;

async function collectReal(): Promise<ShellyData> {
  const url = `http://${config.shellyIp}/rpc`;

  // Fetch EM status (instantaneous) and EMData (energy totals) in parallel
  const [emRes, emDataRes] = await Promise.all([
    fetch(`${url}/EM.GetStatus?id=0`, { signal: AbortSignal.timeout(5000) }),
    fetch(`${url}/EMData.GetStatus?id=0`, { signal: AbortSignal.timeout(5000) }),
  ]);

  if (!emRes.ok || !emDataRes.ok) {
    throw new Error(`Shelly HTTP ${emRes.status}/${emDataRes.status}`);
  }

  const em = await emRes.json() as Record<string, number>;
  const emData = await emDataRes.json() as Record<string, number>;

  const parsePhase = (prefix: string): ShellyPhase => ({
    voltage: em[`${prefix}_voltage`] ?? 0,
    current: em[`${prefix}_current`] ?? 0,
    power: em[`${prefix}_act_power`] ?? 0,
    apparentPower: em[`${prefix}_aprt_power`] ?? 0,
    powerFactor: em[`${prefix}_pf`] ?? 0,
    frequency: em[`${prefix}_freq`] ?? 50,
  });

  const phases: [ShellyPhase, ShellyPhase, ShellyPhase] = [
    parsePhase('a'),
    parsePhase('b'),
    parsePhase('c'),
  ];

  // Energy totals from EMData
  const totalImport = (emData.a_total_act_energy ?? 0) + (emData.b_total_act_energy ?? 0) + (emData.c_total_act_energy ?? 0);
  const totalExport = (emData.a_total_act_ret_energy ?? 0) + (emData.b_total_act_ret_energy ?? 0) + (emData.c_total_act_ret_energy ?? 0);

  status = { ...status, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0, lastError: null };

  return {
    phases,
    totalPower: Math.round(em.total_act_power ?? phases.reduce((s, p) => s + p.power, 0)),
    totalImportWh: Math.round(totalImport),
    totalExportWh: Math.round(totalExport),
  };
}

export async function collectShelly(pvPower: number): Promise<ShellyData> {
  if (config.demoMode) {
    const hour = new Date().getHours();
    let baseConso = 400;
    if (hour >= 7 && hour <= 9) baseConso = 800;
    if (hour >= 11 && hour <= 14) baseConso = 600;
    if (hour >= 18 && hour <= 22) baseConso = 1200;
    if (hour >= 23 || hour <= 5) baseConso = 200;

    baseConso = randomVariation(baseConso, 20);
    const netPower = baseConso - pvPower;
    const perPhase = netPower / 3;

    const phases: [ShellyPhase, ShellyPhase, ShellyPhase] = [
      generateDemoPhase(perPhase),
      generateDemoPhase(perPhase),
      generateDemoPhase(perPhase),
    ];

    const totalPower = phases.reduce((sum, p) => sum + p.power, 0);
    if (totalPower > 0) totalImportWh += (totalPower * 2) / 3600;
    else totalExportWh += (Math.abs(totalPower) * 2) / 3600;

    status = { ...status, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0 };

    return {
      phases,
      totalPower: Math.round(totalPower),
      totalImportWh: Math.round(totalImportWh),
      totalExportWh: Math.round(totalExportWh),
    };
  }

  try {
    return await collectReal();
  } catch (error) {
    status = {
      ...status,
      connected: false,
      errorCount: status.errorCount + 1,
      lastError: error instanceof Error ? error.message : String(error),
    };
    throw error;
  }
}

export function getShellyStatus(): CollectorStatus {
  return status;
}
