import dotenv from 'dotenv';
import path from 'path';

// En dev local, le .env est a la racine du projet (../), en Docker il est monte via env_file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

export const config = {
  port: parseInt(process.env.BACKEND_PORT || '3001', 10),
  demoMode: process.env.DEMO_MODE === 'true',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://solarpulse:solarpulse_secret@postgres:5432/solarpulse',

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',

  // Shelly
  shellyIp: process.env.SHELLY_IP || '192.168.1.XX',
  shellyPollInterval: parseInt(process.env.SHELLY_POLL_INTERVAL_MS || '2000', 10),

  // Hoymiles
  hoymilesDtuIp: process.env.HOYMILES_DTU_IP || '192.168.1.XX',
  hoymilesPollInterval: parseInt(process.env.HOYMILES_POLL_INTERVAL_MS || '3000', 10),
  hoymilesEmail: process.env.HOYMILES_EMAIL || '',
  hoymilesPassword: process.env.HOYMILES_PASSWORD || '',
  hoymilesStationId: process.env.HOYMILES_STATION_ID || '',
  hoymilesMs2aStationId: process.env.HOYMILES_MS2A_STATION_ID || '',

  // Victron
  victronVenusIp: process.env.VICTRON_VENUS_IP || '192.168.1.XX',
  victronMqttPort: parseInt(process.env.VICTRON_MQTT_PORT || '1883', 10),
  victronVrmToken: process.env.VICTRON_VRM_TOKEN || '',
  victronVrmInstallationId: process.env.VICTRON_VRM_INSTALLATION_ID || '',

  // WebSocket
  wsHeartbeatMs: parseInt(process.env.WS_HEARTBEAT_MS || '5000', 10),
};
