import { createHash } from 'crypto';
import { fetch, ProxyAgent } from 'undici';
import { HoymilesData, PVPanel, CollectorStatus } from './types';
import { config } from '../config';
import { isDaylight, nextPollAfterSuccess, backoffDelay } from './hoymiles.schedule';

let pvStatus: CollectorStatus = {
  name: 'Hoymiles PV',
  connected: false,
  lastUpdate: null,
  errorCount: 0,
  lastError: null,
  nextAttempt: null,
};

const DEMO_PEAK_POWER_W = 5000;

const defaultPv: HoymilesData = {
  powerNow: 0, todayYield: 0, totalYield: 0, panels: [], inverterTemp: 0, status: 'offline',
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

function localDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let demoTodayYield = 0;
const demoTotalYield = 1250;

// --- Hoymiles Cloud API ---

const API_HEADERS: Record<string, string> = {
  'accept': 'application/json',
  'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'content-type': 'application/json; charset=UTF-8',
  'language': 'fr-fr',
};

// Fails closed: with a proxy configured, a proxy outage fails the call instead of going out direct.
const dispatcher = config.hoymilesProxyUrl ? new ProxyAgent(config.hoymilesProxyUrl) : undefined;

const DAILY_YIELD_TTL_MS = 15 * 60_000;

let cloudToken: string | null = null;
const sdUriCache: Record<string, string> = {};
let cachedDailyYield: { value: number; date: string; timestamp: number } | null = null;

async function hoymilesPost(url: string, body: unknown, token?: string) {
  console.log(`[Hoymiles] POST ${new URL(url).pathname}${dispatcher ? ' (proxy)' : ''}`);
  return fetch(url, {
    method: 'POST',
    headers: token ? { ...API_HEADERS, authorization: token } : API_HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
    dispatcher,
  });
}

// ── Auth ──

async function hoymilesLogin(): Promise<string> {
  if (!config.hoymilesEmail || !config.hoymilesPassword) {
    throw new Error('HOYMILES_EMAIL and HOYMILES_PASSWORD are required');
  }

  const hash = createHash('md5').update(config.hoymilesPassword).digest('hex');
  const res = await hoymilesPost(`${config.hoymilesApiUrl}/iam/pub/0/auth/login`, {
    user_name: config.hoymilesEmail,
    password: hash,
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
  if (!cloudToken) {
    cloudToken = await hoymilesLogin();
  }
  return cloudToken;
}

function invalidateToken(): void {
  cloudToken = null;
  for (const key of Object.keys(sdUriCache)) {
    delete sdUriCache[key];
  }
}

// ── API helpers ──

async function authenticatedPost(url: string, body: Record<string, unknown>, retry = true): Promise<Record<string, unknown>> {
  const token = await getCloudToken();
  const res = await hoymilesPost(url, body, token);

  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && retry) {
      console.warn(`[Hoymiles] HTTP ${res.status}, retrying once with a fresh token`);
      invalidateToken();
      return authenticatedPost(url, body, false);
    }
    throw new Error(`Hoymiles API HTTP ${res.status} for ${url}`);
  }

  const json = await res.json() as Record<string, unknown>;

  // The API answers HTTP 200 with an error status when the token has expired
  const status = String(json.status ?? '0');
  if (status !== '0' && status !== 'success') {
    if (retry) {
      console.warn(`[Hoymiles] API status=${status} msg=${json.message}, retrying once with a fresh token`);
      invalidateToken();
      return authenticatedPost(url, body, false);
    }
    throw new Error(`Hoymiles API error: status=${status} msg=${json.message}`);
  }

  return json;
}

async function getSdUri(stationId: string): Promise<string> {
  const cached = sdUriCache[stationId];
  if (cached) return cached;

  const json = await authenticatedPost(
    `${config.hoymilesApiUrl}/pvm/api/0/station/get_sd_uri`,
    { sid: Number(stationId) },
  );

  const data = json.data as Record<string, unknown> | undefined;
  const uri = data?.uri as string | undefined;
  if (!uri) {
    console.error('[Hoymiles] getSdUri response:', JSON.stringify(json));
    throw new Error(`Hoymiles: no SD URI for station ${stationId}`);
  }

  console.log(`[Hoymiles] SD URI for station ${stationId}: ${uri}`);
  sdUriCache[stationId] = uri;
  return uri;
}

async function getStationData(stationId: string): Promise<Record<string, unknown>> {
  const sdUri = await getSdUri(stationId);
  const json = await authenticatedPost(sdUri, { data: { m: 0, t: 1 } });
  const data = json.data as Record<string, unknown> | undefined;

  if (!data || !data.power) {
    delete sdUriCache[stationId];
    throw new Error(`Hoymiles: empty station data, response: ${JSON.stringify(json).slice(0, 500)}`);
  }

  return data;
}

async function getDailyYield(stationId: string, now: Date): Promise<number> {
  const today = localDate(now);

  if (cachedDailyYield && cachedDailyYield.date === today && (now.getTime() - cachedDailyYield.timestamp) < DAILY_YIELD_TTL_MS) {
    return cachedDailyYield.value;
  }

  const json = await authenticatedPost(
    `${config.hoymilesApiUrl}/pvm-data/api/0/station/data3/ceqc_a`,
    { sid: Number(stationId), date: today, mode: 1 },
  );

  const data = json.data as Record<string, unknown> | undefined;
  const pvEq = parseFloat(String(data?.pv_eq ?? '0'));
  const yieldKwh = Math.round(pvEq / 10) / 100; // Wh → kWh, 2 decimals

  cachedDailyYield = { value: yieldKwh, date: today, timestamp: now.getTime() };
  return yieldKwh;
}

// ── Real collector ──

async function collectRealHoymiles(now: Date): Promise<HoymilesData> {
  if (!config.hoymilesStationId) {
    throw new Error('HOYMILES_STATION_ID is required');
  }

  // power.pv = instantaneous W, power.pvr = lifetime kWh; the realtime "dly" is wrong, hence getDailyYield
  const data = await getStationData(config.hoymilesStationId);
  const power = data.power as Record<string, number> | undefined;
  const pvPower = power?.pv ?? 0;
  const totalYield = power?.pvr ?? 0;
  const todayYield = await getDailyYield(config.hoymilesStationId, now);

  console.log(`[Hoymiles PV] pv=${pvPower}W dailyYield=${todayYield}kWh totalYield=${totalYield}kWh`);

  return {
    powerNow: Math.round(pvPower),
    todayYield,
    totalYield,
    panels: [],
    inverterTemp: 0,
    status: pvPower > 10 ? 'producing' : 'idle',
  };
}

function collectDemoHoymiles(): HoymilesData {
  const solarFactor = getSolarFactor();
  const totalPower = Math.round(randomVariation(DEMO_PEAK_POWER_W * solarFactor, 10));
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
      yieldToday: Math.round(demoTodayYield / panelCount * 1000) / 1000,
    };
  });

  const actualTotal = panels.reduce((sum, p) => sum + p.power, 0);
  demoTodayYield += (actualTotal * 2) / 3600000;

  pvStatus = { ...pvStatus, connected: true, lastUpdate: new Date().toISOString(), errorCount: 0 };

  return {
    powerNow: actualTotal,
    todayYield: Math.round(demoTodayYield * 100) / 100,
    totalYield: demoTotalYield + demoTodayYield,
    panels,
    inverterTemp: Math.round(randomVariation(40 + solarFactor * 15, 5)),
    status: actualTotal > 10 ? 'producing' : 'idle',
  };
}

// ── Scheduling: daylight only, every 5 min, exponential backoff on failure ──

let lastPv: HoymilesData | null = null;
let lastPvDate = '';
let nextPollAt = 0;
let consecutiveFailures = 0;

export async function collectHoymiles(now: Date): Promise<HoymilesData> {
  if (config.demoMode) return collectDemoHoymiles();

  const today = localDate(now);
  if (today !== lastPvDate) {
    lastPv = null;
    lastPvDate = today;
  }

  if (!isDaylight(now, config.siteLatitude, config.siteLongitude)) {
    return { ...(lastPv ?? defaultPv), powerNow: 0, status: 'idle' };
  }

  if (now.getTime() < nextPollAt) {
    return lastPv ?? defaultPv;
  }

  try {
    lastPv = await collectRealHoymiles(now);
    consecutiveFailures = 0;
    nextPollAt = nextPollAfterSuccess(now.getTime());
    pvStatus = {
      ...pvStatus,
      connected: true,
      lastUpdate: now.toISOString(),
      errorCount: 0,
      lastError: null,
      nextAttempt: new Date(nextPollAt).toISOString(),
    };
  } catch (error) {
    consecutiveFailures++;
    const delay = backoffDelay(consecutiveFailures);
    nextPollAt = now.getTime() + delay;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Hoymiles] ${message} — backoff ${delay / 60_000} min (failure #${consecutiveFailures})`);
    pvStatus = {
      ...pvStatus,
      connected: false,
      errorCount: consecutiveFailures,
      lastError: message,
      nextAttempt: new Date(nextPollAt).toISOString(),
    };
    if (lastPv) lastPv = { ...lastPv, status: 'offline' };
  }

  return lastPv ?? defaultPv;
}

export function getHoymilesStatus(): CollectorStatus {
  return pvStatus;
}
