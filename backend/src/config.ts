import dotenv from 'dotenv';
import path from 'path';

// En dev local, le .env est a la racine du projet (../), en Docker il est monte via env_file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const demoMode = process.env.DEMO_MODE === 'true';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required when DEMO_MODE is not true`);
  }
  return value;
}

function requiredNumber(name: string): number {
  const value = Number(required(name));
  if (Number.isNaN(value)) {
    throw new Error(`${name} must be a number`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.BACKEND_PORT || '3001', 10),
  demoMode,

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://solarpulse:solarpulse_secret@postgres:5432/solarpulse',

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  registerSecret: process.env.REGISTER_SECRET || '',

  // Site (sunrise/sunset for Hoymiles polling)
  siteLatitude: demoMode ? 0 : requiredNumber('SITE_LATITUDE'),
  siteLongitude: demoMode ? 0 : requiredNumber('SITE_LONGITUDE'),

  // Shelly
  shellyIp: process.env.SHELLY_IP || '192.168.1.XX',

  // Hoymiles
  hoymilesApiUrl: demoMode ? '' : required('HOYMILES_API_URL'),
  hoymilesProxyUrl: process.env.HOYMILES_PROXY_URL || '',
  hoymilesEmail: process.env.HOYMILES_EMAIL || '',
  hoymilesPassword: process.env.HOYMILES_PASSWORD || '',
  hoymilesStationId: process.env.HOYMILES_STATION_ID || '',

  // Victron
  victronVenusIp: process.env.VICTRON_VENUS_IP || '192.168.1.XX',
  victronMqttPort: parseInt(process.env.VICTRON_MQTT_PORT || '1883', 10),

  // WebSocket
  wsHeartbeatMs: parseInt(process.env.WS_HEARTBEAT_MS || '5000', 10),
};
