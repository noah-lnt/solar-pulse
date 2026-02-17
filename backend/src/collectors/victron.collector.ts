import mqtt, { MqttClient } from 'mqtt';
import { VictronData, LiFePO4DiyData, CollectorStatus } from './types';
import { config } from '../config';

let victronStatus: CollectorStatus = {
  name: 'Victron MultiPlus',
  connected: false,
  lastUpdate: null,
  errorCount: 0,
  lastError: null,
};

let lifepoStatus: CollectorStatus = {
  name: 'LiFePO4 DIY',
  connected: false,
  lastUpdate: null,
  errorCount: 0,
  lastError: null,
};

function randomVariation(base: number, percent: number): number {
  return base + base * (Math.random() - 0.5) * 2 * (percent / 100);
}

let lifepoSoc = 72;
let lifepoCycles = 87;

// --- Venus OS MQTT Client ---
// Topics: N/{portalId}/{service}/{instanceId}/{path}
// Values: JSON { "value": <number> }

let mqttClient: MqttClient | null = null;
let portalId: string | null = null;
let mqttConnected = false;
let mqttInitStarted = false;

// Cached values from MQTT messages
const mqttValues: Record<string, number> = {};

// Keepalive interval
let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

function extractValue(payload: Buffer): number | null {
  try {
    const parsed = JSON.parse(payload.toString());
    if (parsed && typeof parsed.value === 'number') {
      return parsed.value;
    }
    if (typeof parsed === 'number') return parsed;
    return null;
  } catch {
    return null;
  }
}

function initMqtt(): void {
  if (mqttInitStarted) return;
  mqttInitStarted = true;

  const ip = config.victronVenusIp;
  if (!ip || ip === '192.168.1.XX') {
    console.warn('[Victron] VICTRON_VENUS_IP not configured, skipping MQTT');
    return;
  }

  const port = config.victronMqttPort;
  const url = `mqtt://${ip}:${port}`;

  console.log(`[Victron] Connecting to MQTT at ${url}...`);

  mqttClient = mqtt.connect(url, {
    connectTimeout: 10000,
    reconnectPeriod: 5000,
    keepalive: 30,
  });

  mqttClient.on('connect', () => {
    console.log('[Victron] MQTT connected');
    mqttConnected = true;

    // Subscribe to all N/ topics to discover portalId
    mqttClient!.subscribe('N/#', (err) => {
      if (err) console.error('[Victron] MQTT subscribe error:', err.message);
      else console.log('[Victron] Subscribed to N/#');
    });
  });

  mqttClient.on('message', (topic: string, payload: Buffer) => {
    // Discover portalId from first message
    // Topics are: N/{portalId}/...
    if (!portalId) {
      const parts = topic.split('/');
      if (parts[0] === 'N' && parts.length >= 3) {
        portalId = parts[1];
        console.log(`[Victron] Discovered portalId: ${portalId}`);

        // Start keepalive: must periodically publish to R/{portalId}/keepalive
        // to keep receiving data
        startKeepalive();
      }
    }

    // Extract the path relative to N/{portalId}/
    const prefix = `N/${portalId}/`;
    if (!topic.startsWith(prefix)) return;

    const subPath = topic.substring(prefix.length);
    const val = extractValue(payload);

    if (val !== null) {
      mqttValues[subPath] = val;
    }
  });

  mqttClient.on('error', (err) => {
    console.error('[Victron] MQTT error:', err.message);
    mqttConnected = false;
  });

  mqttClient.on('close', () => {
    console.warn('[Victron] MQTT connection closed');
    mqttConnected = false;
  });

  mqttClient.on('reconnect', () => {
    console.log('[Victron] MQTT reconnecting...');
  });
}

function startKeepalive(): void {
  if (keepaliveInterval) return;
  if (!mqttClient || !portalId) return;

  // Venus OS requires periodic keepalive to keep publishing data
  const sendKeepalive = () => {
    if (mqttClient && portalId) {
      mqttClient.publish(`R/${portalId}/keepalive`, '');
    }
  };

  sendKeepalive();
  keepaliveInterval = setInterval(sendKeepalive, 20000);
}

// Find a value matching a pattern in cached MQTT values
// Venus OS uses instance IDs that we need to discover
function findValue(servicePattern: string, path: string): number | null {
  // Try exact match first
  const exact = mqttValues[`${servicePattern}/${path}`];
  if (exact !== undefined) return exact;

  // Search through all cached values for matching service type and path
  for (const [key, val] of Object.entries(mqttValues)) {
    const parts = key.split('/');
    // key format: service/instanceId/path...
    if (parts[0] === servicePattern.split('/')[0]) {
      // Check if the path portion matches
      const pathStart = key.indexOf('/', key.indexOf('/') + 1);
      if (pathStart >= 0) {
        const keyPath = key.substring(pathStart + 1);
        if (keyPath === path) {
          return val;
        }
      }
    }
  }
  return null;
}

function getVebusValue(path: string, fallback: number = 0): number {
  // Search for vebus/<any-id>/<path>
  for (const [key, val] of Object.entries(mqttValues)) {
    if (key.startsWith('vebus/') && key.endsWith(`/${path}`)) {
      return val;
    }
  }
  return fallback;
}

function getBatteryValue(path: string, fallback: number = 0): number {
  // Search for battery/<any-id>/<path>
  for (const [key, val] of Object.entries(mqttValues)) {
    if (key.startsWith('battery/') && key.endsWith(`/${path}`)) {
      return val;
    }
  }
  return fallback;
}

// Discover all battery instance IDs from MQTT cache
function getBatteryInstanceIds(): string[] {
  const ids = new Set<string>();
  for (const key of Object.keys(mqttValues)) {
    if (key.startsWith('battery/')) {
      const parts = key.split('/');
      if (parts.length >= 3) {
        ids.add(parts[1]);
      }
    }
  }
  return Array.from(ids).sort();
}

// Read cell voltages from MQTT for all battery instances
// dbus-serialbattery publishes: battery/{instanceId}/Voltages/Cell1 ... CellN
function readCellVoltages(): { cellVoltages: number[]; cellCount: number; batteries: { id: string; cells: number[] }[] } {
  const instanceIds = getBatteryInstanceIds();
  const batteries: { id: string; cells: number[] }[] = [];

  for (const instId of instanceIds) {
    const cells: number[] = [];
    // Try reading Cell1 to Cell32 (max supported by Venus OS)
    for (let i = 1; i <= 32; i++) {
      const key = `battery/${instId}/Voltages/Cell${i}`;
      const val = mqttValues[key];
      if (val !== undefined && val > 0) {
        cells.push(val);
      } else {
        break; // No more cells for this instance
      }
    }
    if (cells.length > 0) {
      batteries.push({ id: instId, cells });
    }
  }

  // Flatten all cells into one array
  const allCells = batteries.flatMap(b => b.cells);
  return {
    cellVoltages: allCells,
    cellCount: allCells.length,
    batteries,
  };
}

function getSystemValue(path: string, fallback: number = 0): number {
  // Search for system/0/<path>
  const val = mqttValues[`system/0/${path}`];
  return val ?? fallback;
}

// ── Exported functions ──

export async function collectVictron(pvPower: number, gridPower: number): Promise<VictronData> {
  if (config.demoMode) {
    const hour = new Date().getHours();
    const isNight = hour < 7 || hour > 19;

    let mode: VictronData['mode'] = 'passthrough';
    let outputPower = 0;

    if (pvPower > 500 && gridPower < 0) {
      mode = 'charging';
      outputPower = Math.round(randomVariation(pvPower * 0.3, 10));
    } else if (isNight && lifepoSoc > 20) {
      mode = 'inverting';
      outputPower = Math.round(randomVariation(400, 20));
    } else {
      mode = 'passthrough';
      outputPower = Math.round(randomVariation(200, 30));
    }

    victronStatus = { ...victronStatus, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0 };

    return {
      mode,
      inputVoltage: Math.round(randomVariation(230, 2) * 10) / 10,
      inputFrequency: Math.round(randomVariation(50, 0.2) * 100) / 100,
      outputVoltage: Math.round(randomVariation(230, 1) * 10) / 10,
      outputFrequency: 50.0,
      outputPower,
      loadPercent: Math.round((outputPower / 3000) * 100),
      warnings: [],
      alarms: [],
    };
  }

  // Real mode: MQTT
  initMqtt();

  if (!mqttConnected) {
    victronStatus = {
      ...victronStatus,
      connected: false,
      errorCount: victronStatus.errorCount + 1,
      lastError: 'MQTT not connected',
    };
    throw new Error('Victron MQTT not connected');
  }

  if (!portalId) {
    victronStatus = {
      ...victronStatus,
      connected: false,
      lastError: 'Waiting for portalId discovery',
    };
    throw new Error('Victron: waiting for portalId discovery');
  }

  const modeVal = getVebusValue('Mode', 3);
  const inputVoltage = getVebusValue('Ac/ActiveIn/L1/V');
  const inputFrequency = getVebusValue('Ac/ActiveIn/L1/F');
  const outputVoltage = getVebusValue('Ac/Out/L1/V');
  const outputFrequency = getVebusValue('Ac/Out/L1/F', 50);
  const outputPower = getVebusValue('Ac/Out/L1/P');

  const modeMap: Record<number, VictronData['mode']> = {
    1: 'charging',
    2: 'inverting',
    3: 'passthrough',
    4: 'off',
  };
  const mode = modeMap[Math.round(modeVal)] ?? 'passthrough';
  const maxPower = 3000;

  victronStatus = { ...victronStatus, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0, lastError: null };

  console.log(`[Victron] mode=${mode} inputV=${inputVoltage}V outputP=${outputPower}W (via MQTT)`);

  return {
    mode,
    inputVoltage: Math.round(inputVoltage * 10) / 10,
    inputFrequency: Math.round(inputFrequency * 100) / 100,
    outputVoltage: Math.round(outputVoltage * 10) / 10,
    outputFrequency: Math.round(outputFrequency * 100) / 100,
    outputPower: Math.round(outputPower),
    loadPercent: Math.round((Math.abs(outputPower) / maxPower) * 100),
    warnings: [],
    alarms: [],
  };
}

export async function collectLiFePO4(victronMode: VictronData['mode'], victronPower: number): Promise<LiFePO4DiyData> {
  if (config.demoMode) {
    let batteryPower = 0;

    if (victronMode === 'charging' && lifepoSoc < 100) {
      batteryPower = -Math.min(victronPower * 0.6, 1500);
      lifepoSoc += Math.abs(batteryPower) * 2 / (5000 * 3600) * 100;
    } else if (victronMode === 'inverting' && lifepoSoc > 10) {
      batteryPower = Math.min(victronPower, 1500);
      lifepoSoc -= batteryPower * 2 / (5000 * 3600) * 100;
    }

    lifepoSoc = Math.max(5, Math.min(100, lifepoSoc));

    const cellsPerPack = 16;
    const avgCellVoltage = 3.2 + (lifepoSoc / 100) * 0.25;

    // Demo: 2 battery packs of 16 cells each
    const pack1Cells = Array.from({ length: cellsPerPack }, () =>
      Math.round(randomVariation(avgCellVoltage, 0.3) * 1000) / 1000
    );
    const pack2Cells = Array.from({ length: cellsPerPack }, () =>
      Math.round(randomVariation(avgCellVoltage, 0.3) * 1000) / 1000
    );

    const cellVoltages = [...pack1Cells, ...pack2Cells];
    const cellCount = cellVoltages.length;
    const minCell = Math.min(...cellVoltages);
    const maxCell = Math.max(...cellVoltages);

    const voltage = cellVoltages.reduce((a, b) => a + b, 0);
    const current = batteryPower / (voltage || 1);

    lifepoStatus = { ...lifepoStatus, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0 };

    return {
      soc: Math.round(lifepoSoc * 10) / 10,
      power: Math.round(batteryPower),
      voltage: Math.round(voltage * 10) / 10,
      current: Math.round(current * 100) / 100,
      temperature: Math.round(randomVariation(26, 8)),
      capacityWh: 32000,
      status: batteryPower < -10 ? 'charging' : batteryPower > 10 ? 'discharging' : 'idle',
      cycles: lifepoCycles,
      cellVoltages,
      cellCount,
      bmsTemperature: Math.round(randomVariation(27, 8)),
      balancing: Math.abs(maxCell - minCell) > 0.01,
      minCellVoltage: Math.round(minCell * 1000) / 1000,
      maxCellVoltage: Math.round(maxCell * 1000) / 1000,
      cellDelta: Math.round((maxCell - minCell) * 1000),
      batteryPacks: [
        { id: 'pack-1', cells: pack1Cells },
        { id: 'pack-2', cells: pack2Cells },
      ],
    };
  }

  // Real mode: MQTT
  initMqtt();

  if (!mqttConnected || !portalId) {
    lifepoStatus = {
      ...lifepoStatus,
      connected: false,
      errorCount: lifepoStatus.errorCount + 1,
      lastError: !mqttConnected ? 'MQTT not connected' : 'Waiting for portalId',
    };
    throw new Error('Victron MQTT not ready for LiFePO4 data');
  }

  // Get battery data from MQTT cache
  const soc = getBatteryValue('Soc');
  const voltage = getBatteryValue('Dc/0/Voltage');
  const currentRaw = getBatteryValue('Dc/0/Current');
  const powerRaw = getBatteryValue('Dc/0/Power', voltage * currentRaw);
  const temperature = getBatteryValue('Dc/0/Temperature', 25);

  // Victron MQTT: positive = charging, negative = discharging
  // SolarPulse convention: positive = discharging, negative = charging → invert
  const power = -powerRaw;
  const current = -currentRaw;

  // Read real cell voltages from MQTT (dbus-serialbattery publishes Voltages/Cell1..CellN)
  const cellData = readCellVoltages();
  let cellVoltages: number[];
  let cellCount: number;

  if (cellData.cellCount > 0) {
    cellVoltages = cellData.cellVoltages;
    cellCount = cellData.cellCount;
    if (cellData.batteries.length > 1) {
      console.log(`[LiFePO4] ${cellData.batteries.length} batteries detected: ${cellData.batteries.map(b => `${b.id}(${b.cells.length} cells)`).join(', ')}`);
    }
  } else {
    // Fallback: estimate from total voltage if no cell data available
    cellCount = 16;
    const avgCellVoltage = voltage > 0 ? voltage / cellCount : 0;
    cellVoltages = Array.from({ length: cellCount }, () => avgCellVoltage);
  }

  const minCell = cellVoltages.length > 0 ? Math.min(...cellVoltages) : 0;
  const maxCell = cellVoltages.length > 0 ? Math.max(...cellVoltages) : 0;

  let batteryStatus: LiFePO4DiyData['status'] = 'idle';
  if (power < -10) batteryStatus = 'charging';
  else if (power > 10) batteryStatus = 'discharging';

  // Try to read min/max from MQTT System paths (always published even without individual cells)
  const mqttMinCell = getBatteryValue('System/MinCellVoltage');
  const mqttMaxCell = getBatteryValue('System/MaxCellVoltage');
  const finalMinCell = mqttMinCell > 0 ? mqttMinCell : minCell;
  const finalMaxCell = mqttMaxCell > 0 ? mqttMaxCell : maxCell;

  // Check if any cell is balancing
  let balancing = false;
  for (const key of Object.keys(mqttValues)) {
    if (key.startsWith('battery/') && key.includes('/Balances/Cell') && mqttValues[key] === 1) {
      balancing = true;
      break;
    }
  }

  lifepoStatus = { ...lifepoStatus, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0, lastError: null };

  console.log(`[LiFePO4] soc=${soc}% power=${power}W voltage=${voltage}V cells=${cellCount} (via MQTT)`);

  return {
    soc: Math.round(soc * 10) / 10,
    power: Math.round(power),
    voltage: Math.round(voltage * 10) / 10,
    current: Math.round(current * 100) / 100,
    temperature: Math.round(temperature),
    capacityWh: 32000,
    status: batteryStatus,
    cycles: 0,
    cellVoltages: cellVoltages.map(v => Math.round(v * 1000) / 1000),
    cellCount,
    bmsTemperature: Math.round(temperature),
    balancing,
    minCellVoltage: Math.round(finalMinCell * 1000) / 1000,
    maxCellVoltage: Math.round(finalMaxCell * 1000) / 1000,
    cellDelta: Math.round((finalMaxCell - finalMinCell) * 1000),
    batteryPacks: cellData.batteries.map(b => ({
      id: `pack-${b.id}`,
      cells: b.cells.map(v => Math.round(v * 1000) / 1000),
    })),
  };
}

// ── Control: set Victron mode via MQTT ──
// Venus OS MQTT: write to W/{portalId}/vebus/{instanceId}/Mode
// Mode values: 1=Charger Only, 2=Inverter Only, 3=On (passthrough), 4=Off

function getVebusInstanceId(): string | null {
  // Find the vebus instance ID from cached MQTT values
  for (const key of Object.keys(mqttValues)) {
    if (key.startsWith('vebus/') && key.endsWith('/Mode')) {
      // key = "vebus/276/Mode" → extract "276"
      const parts = key.split('/');
      return parts[1];
    }
  }
  return null;
}

export function setVictronMode(mode: 'on' | 'off' | 'charger' | 'inverter'): { success: boolean; error?: string } {
  if (!mqttClient || !mqttConnected) {
    return { success: false, error: 'MQTT not connected' };
  }

  if (!portalId) {
    return { success: false, error: 'Portal ID not discovered yet' };
  }

  const instanceId = getVebusInstanceId();
  if (!instanceId) {
    return { success: false, error: 'VEBus instance ID not found' };
  }

  // Map mode names to Venus OS mode values
  const modeMap: Record<string, number> = {
    on: 3,        // On (passthrough/normal)
    off: 4,       // Off
    charger: 1,   // Charger only
    inverter: 2,  // Inverter only
  };

  const modeValue = modeMap[mode];
  if (modeValue === undefined) {
    return { success: false, error: `Invalid mode: ${mode}` };
  }

  const topic = `W/${portalId}/vebus/${instanceId}/Mode`;
  const payload = JSON.stringify({ value: modeValue });

  console.log(`[Victron] Setting mode to ${mode} (${modeValue}) via ${topic}`);
  mqttClient.publish(topic, payload);

  return { success: true };
}

export function isVictronMqttReady(): boolean {
  return mqttConnected && portalId !== null;
}

export function getVictronStatus(): CollectorStatus {
  return victronStatus;
}

export function getLiFePoStatus(): CollectorStatus {
  return lifepoStatus;
}
