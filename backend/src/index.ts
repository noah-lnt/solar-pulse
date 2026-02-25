import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { initDatabase } from './db';
import { authMiddleware } from './auth/middleware';
import { authRoutes } from './auth/routes';
import { statusRoutes } from './routes/status';
import { healthRoutes } from './routes/health';
import { historyRoutes } from './routes/history';
import { dailyRoutes } from './routes/daily';
import { victronRoutes } from './routes/victron';
import { setupWebSocket, broadcast } from './websocket';
import { aggregate, loadHistory } from './aggregator';

async function main() {
  // Init database
  await initDatabase();
  console.log('[Server] Database ready');

  // Load persisted history from database
  await loadHistory();

  const app = express();
  const server = http.createServer(app);

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(authMiddleware);

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/status', statusRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/history', dailyRoutes);
  app.use('/api/victron', victronRoutes);

  // WebSocket
  setupWebSocket(server);

  // Start polling
  const POLL_INTERVAL = 2000;
  setInterval(async () => {
    try {
      const state = await aggregate();
      broadcast(state);
    } catch (error) {
      console.error('[Aggregator] Error:', error);
    }
  }, POLL_INTERVAL);

  // Initial collection
  try {
    await aggregate();
    console.log(`[Server] Initial data collected (demo=${config.demoMode})`);
  } catch (error) {
    console.error('[Server] Initial collection failed:', error);
  }

  server.listen(config.port, () => {
    console.log(`[Server] SolarPulse backend running on port ${config.port}`);
    console.log(`[Server] Demo mode: ${config.demoMode}`);
  });
}

main().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});
