import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS history (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
      pv_power REAL NOT NULL DEFAULT 0,
      grid_power REAL NOT NULL DEFAULT 0,
      battery_power REAL NOT NULL DEFAULT 0,
      consumption REAL NOT NULL DEFAULT 0,
      grid_import_wh REAL NOT NULL DEFAULT 0,
      grid_export_wh REAL NOT NULL DEFAULT 0,
      ms2a_soc REAL NOT NULL DEFAULT 0,
      ms2a_power REAL NOT NULL DEFAULT 0,
      lifepe_soc REAL NOT NULL DEFAULT 0,
      lifepe_power REAL NOT NULL DEFAULT 0,
      victron_mode VARCHAR(20) NOT NULL DEFAULT 'off'
    )
  `);

  // Add new columns if table already exists (migration)
  const newCols = [
    { name: 'grid_import_wh', type: 'REAL NOT NULL DEFAULT 0' },
    { name: 'grid_export_wh', type: 'REAL NOT NULL DEFAULT 0' },
    { name: 'ms2a_soc', type: 'REAL NOT NULL DEFAULT 0' },
    { name: 'ms2a_power', type: 'REAL NOT NULL DEFAULT 0' },
    { name: 'lifepe_soc', type: 'REAL NOT NULL DEFAULT 0' },
    { name: 'lifepe_power', type: 'REAL NOT NULL DEFAULT 0' },
    { name: 'victron_mode', type: "VARCHAR(20) NOT NULL DEFAULT 'off'" },
  ];
  for (const col of newCols) {
    try {
      await pool.query(`ALTER TABLE history ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
    } catch {
      // Column may already exist on older PostgreSQL without IF NOT EXISTS support
    }
  }

  // Index for fast time-range queries
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history (timestamp DESC)
  `);

  console.log('[DB] Schema initialized');
}
