import { createHash } from 'crypto';
import { HoymilesData, BatteryData, PVPanel, CollectorStatus } from './types';
import { config } from '../config';

let pvStatus: CollectorStatus = {
  name: 'Hoymiles PV',
  connected: false,
  lastUpdate: null,
  errorCount: 0,
  lastError: null,
};

let ms2aStatus: CollectorStatus = {
  name: 'Hoymiles MS-2A',
  connected: false,
  lastUpdate: null,
  errorCount: 0,
  lastError: null,
};

function randomVariation(base: number, percent: number): number {
  return base + base * (Math.random() - 0.5) * 2 * (percent / 100);
}

function getSolarFactor(): number {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < 7 || hour > 19) return 0;
  const normalized = (hour - 7) / 12;
  return Math.sin(normalized * Math.PI);
}

let todayYield = 0;
const totalYield = 1250;
let ms2aSoc = 65;
let ms2aCycles = 142;

// --- Hoymiles Cloud API (neapi.hoymiles.com) ---
const HOYMILES_API_BASE = 'https://neapi.hoymiles.com';

const API_HEADERS: Record<string, string> = {
  'accept': 'application/json',
  'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'content-type': 'application/json; charset=UTF-8',
  'language': 'fr-fr',
};

let cloudToken: string | null = null;
let tokenTimestamp = 0;
const TOKEN_TTL_MS = 3 * 60 * 1000; // Renouveler le token toutes les 3 minutes
// Cache SD URIs per station ID (with TTL)
const sdUriCache: Record<string, { uri: string; timestamp: number }> = {};
const SD_URI_TTL_MS = 2 * 60 * 1000; // SD URI expire toutes les 2 minutes

// ── Auth ──

async function hoymilesLogin(): Promise<string> {
  if (!config.hoymilesEmail || !config.hoymilesPassword) {
    throw new Error('HOYMILES_EMAIL et HOYMILES_PASSWORD requis');
  }

  const hash = createHash('md5').update(config.hoymilesPassword).digest('hex');

  console.log('[Hoymiles] Logging in...');

  const res = await fetch(`${HOYMILES_API_BASE}/iam/pub/0/auth/login`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({
      user_name: config.hoymilesEmail,
      password: hash,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Hoymiles login HTTP ${res.status}`);
  }

  const json = await res.json() as { status?: string; message?: string; data?: { token?: string } };
  const token = json.data?.token;
  if (!token) {
    throw new Error(`Hoymiles login failed: ${json.message || 'no token'}`);
  }

  console.log('[Hoymiles] Login OK');
  return token;
}

async function getCloudToken(): Promise<string> {
  const now = Date.now();
  // Renouveler le token s'il est expire ou n'existe pas
  if (!cloudToken || (now - tokenTimestamp) >= TOKEN_TTL_MS) {
    if (cloudToken) {
      console.log('[Hoymiles] Token expired, renewing...');
    }
    // Invalider aussi le cache SD URI car il est lie a la session
    for (const key of Object.keys(sdUriCache)) {
      delete sdUriCache[key];
    }
    cloudToken = await hoymilesLogin();
    tokenTimestamp = now;
  }
  return cloudToken;
}

function invalidateToken(): void {
  cloudToken = null;
  tokenTimestamp = 0;
  // Clear SD URI cache too since they may be tied to the session
  for (const key of Object.keys(sdUriCache)) {
    delete sdUriCache[key];
  }
}

// ── API helpers ──

async function authenticatedPost(url: string, body: Record<string, unknown>, retry = true): Promise<Record<string, unknown>> {
  const token = await getCloudToken();

  const res = await fetch(url, {
    method: 'POST',
    headers: { ...API_HEADERS, authorization: token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      invalidateToken();
      // Retry once with fresh token
      if (retry) {
        console.warn(`[Hoymiles] HTTP ${res.status}, retrying with fresh token...`);
        return authenticatedPost(url, body, false);
      }
    }
    throw new Error(`Hoymiles API HTTP ${res.status} for ${url}`);
  }

  const json = await res.json() as Record<string, unknown>;

  // Hoymiles API can return HTTP 200 with error status when token is expired
  const status = String(json.status ?? '0');
  if (status !== '0' && status !== 'success') {
    if (retry) {
      console.warn(`[Hoymiles] API status=${status} msg=${json.message}, retrying with fresh token...`);
      invalidateToken();
      return authenticatedPost(url, body, false);
    }
    throw new Error(`Hoymiles API error: status=${status} msg=${json.message}`);
  }

  return json;
}

async function getSdUri(stationId: string): Promise<string> {
  const now = Date.now();
  const cached = sdUriCache[stationId];
  if (cached && (now - cached.timestamp) < SD_URI_TTL_MS) {
    return cached.uri;
  }

  const json = await authenticatedPost(
    `${HOYMILES_API_BASE}/pvm/api/0/station/get_sd_uri`,
    { sid: Number(stationId) },
  );

  const data = json.data as Record<string, unknown> | undefined;
  const uri = data?.uri as string | undefined;
  if (!uri) {
    console.error('[Hoymiles] getSdUri response:', JSON.stringify(json));
    throw new Error(`Hoymiles: pas de SD URI pour station ${stationId}`);
  }

  console.log(`[Hoymiles] SD URI for station ${stationId}: ${uri}`);
  sdUriCache[stationId] = { uri, timestamp: now };
  return uri;
}

async function getStationData(sdUri: string): Promise<Record<string, unknown>> {
  const json = await authenticatedPost(sdUri, { data: { m: 0, t: 1 } });
  // Response structure: { status: '0', message: 'success', data: { power: {...}, soc: ... } }
  const data = json.data as Record<string, unknown> | undefined;

  if (!data || !data.power) {
    console.warn(`[Hoymiles] Empty station data from ${sdUri}, response:`, JSON.stringify(json).slice(0, 500));
    // SD URI may have expired — clear cache to force refresh next time
    for (const [key, cached] of Object.entries(sdUriCache)) {
      if (cached.uri === sdUri) {
        delete sdUriCache[key];
        console.warn(`[Hoymiles] Cleared cached SD URI for station ${key}`);
      }
    }
  }

  return data ?? {};
}

// ── Shared cache for MS-2A station data ──
// All panels go through the MS-2A, so pv2 from MS-2A station is the real-time PV power.
// The classic PV station has a ~5 min sync delay, so we prefer MS-2A data.
// We cache the full MS-2A response to avoid double API calls (used by both PV and MS-2A collectors).
let cachedMs2aData: Record<string, unknown> | null = null;
let cachedMs2aTimestamp = 0;
const MS2A_CACHE_TTL_MS = 2000; // Cache for 2 seconds

async function getMs2aData(): Promise<Record<string, unknown> | null> {
  if (!config.hoymilesMs2aStationId) return null;

  const now = Date.now();
  if (cachedMs2aData && (now - cachedMs2aTimestamp) < MS2A_CACHE_TTL_MS) {
    return cachedMs2aData;
  }

  const sdUri = await getSdUri(config.hoymilesMs2aStationId);
  cachedMs2aData = await getStationData(sdUri);
  cachedMs2aTimestamp = now;
  return cachedMs2aData;
}

// ── Real collectors ──

async function collectRealHoymiles(): Promise<HoymilesData> {
  // Source unique : HOYMILES_STATION_ID (station PV classique)
  // power.pv = puissance instantanee (W)
  // pvr = yield total cumule (kWh) — PAS le daily !
  // dly = yield journalier (Wh) — diviser par 1000 pour kWh
  let pvPower = 0;
  let pvYield = 0;
  let totalYield = 0;

  if (config.hoymilesStationId) {
    const sdUri = await getSdUri(config.hoymilesStationId);
    const data = await getStationData(sdUri);
    const power = data.power as Record<string, number> | undefined;
    pvPower = power?.pv ?? 0;
    totalYield = power?.pvr ?? 0; // Cumul total en kWh

    // dly = production journaliere en Wh
    const dlyWh = typeof data.dly === 'number' ? data.dly : 0;
    pvYield = Math.round(dlyWh / 10) / 100; // Wh → kWh avec 2 decimales
  }

  pvStatus = { ...pvStatus, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0, lastError: null };

  console.log(`[Hoymiles PV] pv=${pvPower}W dailyYield=${pvYield}kWh totalYield=${totalYield}kWh`);

  return {
    powerNow: Math.round(pvPower),
    todayYield: pvYield,
    totalYield,
    panels: [],
    inverterTemp: 0,
    status: pvPower > 10 ? 'producing' : 'idle',
  };
}

async function collectRealMS2A(): Promise<BatteryData> {
  const ms2aData = await getMs2aData();
  if (!ms2aData) {
    ms2aStatus = { ...ms2aStatus, connected: false, lastError: 'HOYMILES_MS2A_STATION_ID requis' };
    return {
      soc: 0, power: 0, voltage: 0, current: 0, temperature: 0,
      capacityWh: 2400, status: 'offline', cycles: 0,
    };
  }

  // Response structure for MS-2A station:
  // {
  //   power: { pv: 0, pv2: 556.7, pvr: 0, pvr2: 0, bat: 543.6, grid: 13.1, load: 0, sp: 0 },
  //   soc: 46.9,
  //   flow: [...],
  //   brs: 1, chs: 0, bhs: 0, ems: 2
  // }
  const power = ms2aData.power as Record<string, number> | undefined;

  const soc = parseFloat(String(ms2aData.soc ?? 0));
  const batRaw = power?.bat ?? 0;
  // Hoymiles API: bat positive = discharging, negative = charging (same convention as SolarPulse)
  const batPower = batRaw;
  const ms2aPvPower = power?.pv2 ?? 0;    // PV power through MS-2A
  const gridPowerMs2a = power?.grid ?? 0; // Grid exchange through MS-2A
  const loadPower = power?.load ?? 0;     // Load through MS-2A

  ms2aStatus = { ...ms2aStatus, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0, lastError: null };

  console.log(`[Hoymiles MS-2A] soc=${soc}% bat=${batPower}W pv2=${ms2aPvPower}W grid=${gridPowerMs2a}W load=${loadPower}W`);

  return {
    soc: Math.round(soc * 10) / 10,
    power: Math.round(batPower),
    voltage: 0,
    current: 0,
    temperature: 0,
    capacityWh: 2400,
    status: batPower < -10 ? 'charging' : batPower > 10 ? 'discharging' : 'idle',
    cycles: 0,
  };
}

// ── Exported functions ──

export async function collectHoymiles(): Promise<HoymilesData> {
  if (config.demoMode) {
    const solarFactor = getSolarFactor();
    const maxPower = 3000;
    const totalPower = Math.round(randomVariation(maxPower * solarFactor, 10));
    const panelCount = 6;

    const panels: PVPanel[] = Array.from({ length: panelCount }, (_, i) => {
      const panelPower = Math.max(0, Math.round(randomVariation(totalPower / panelCount, 8)));
      const voltage = solarFactor > 0 ? randomVariation(37, 3) : 0;
      const current = voltage > 0 ? panelPower / voltage : 0;
      return {
        id: `PV-${i + 1}`,
        power: panelPower,
        voltage: Math.round(voltage * 10) / 10,
        current: Math.round(current * 100) / 100,
        temperature: Math.round(randomVariation(35 + solarFactor * 20, 10)),
        yieldToday: Math.round(todayYield / panelCount * 1000) / 1000,
      };
    });

    const actualTotal = panels.reduce((sum, p) => sum + p.power, 0);
    todayYield += (actualTotal * 2) / 3600000;

    pvStatus = { ...pvStatus, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0 };

    return {
      powerNow: actualTotal,
      todayYield: Math.round(todayYield * 100) / 100,
      totalYield: totalYield + todayYield,
      panels,
      inverterTemp: Math.round(randomVariation(40 + solarFactor * 15, 5)),
      status: actualTotal > 10 ? 'producing' : 'idle',
    };
  }

  try {
    return await collectRealHoymiles();
  } catch (error) {
    pvStatus = {
      ...pvStatus,
      connected: false,
      errorCount: pvStatus.errorCount + 1,
      lastError: error instanceof Error ? error.message : String(error),
    };
    throw error;
  }
}

export async function collectMS2A(pvPower: number, gridPower: number): Promise<BatteryData> {
  if (config.demoMode) {
    const surplus = pvPower - Math.abs(gridPower > 0 ? 0 : gridPower);
    let batteryPower = 0;

    if (surplus > 100 && ms2aSoc < 100) {
      batteryPower = -Math.min(surplus * 0.5, 1000);
      ms2aSoc += Math.abs(batteryPower) * 2 / (2000 * 3600) * 100;
    } else if (gridPower > 200 && ms2aSoc > 10) {
      batteryPower = Math.min(gridPower * 0.4, 800);
      ms2aSoc -= batteryPower * 2 / (2000 * 3600) * 100;
    }

    ms2aSoc = Math.max(5, Math.min(100, ms2aSoc));

    const voltage = randomVariation(51.2 + (ms2aSoc - 50) * 0.05, 1);
    const current = batteryPower / voltage;

    ms2aStatus = { ...ms2aStatus, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0 };

    return {
      soc: Math.round(ms2aSoc * 10) / 10,
      power: Math.round(batteryPower),
      voltage: Math.round(voltage * 10) / 10,
      current: Math.round(current * 100) / 100,
      temperature: Math.round(randomVariation(28, 10)),
      capacityWh: 2400,
      status: batteryPower < -10 ? 'charging' : batteryPower > 10 ? 'discharging' : 'idle',
      cycles: ms2aCycles,
    };
  }

  try {
    return await collectRealMS2A();
  } catch (error) {
    ms2aStatus = {
      ...ms2aStatus,
      connected: false,
      errorCount: ms2aStatus.errorCount + 1,
      lastError: error instanceof Error ? error.message : String(error),
    };
    throw error;
  }
}

export function getHoymilesStatus(): CollectorStatus {
  return pvStatus;
}

export function getMS2AStatus(): CollectorStatus {
  return ms2aStatus;
}
