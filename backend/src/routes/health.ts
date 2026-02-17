import { Router } from 'express';
import { getShellyStatus } from '../collectors/shelly.collector';
import { getHoymilesStatus, getMS2AStatus } from '../collectors/hoymiles.collector';
import { getVictronStatus, getLiFePoStatus } from '../collectors/victron.collector';

const router = Router();

router.get('/', (_req, res) => {
  const collectors = [
    getShellyStatus(),
    getHoymilesStatus(),
    getMS2AStatus(),
    getVictronStatus(),
    getLiFePoStatus(),
  ];

  const allConnected = collectors.every((c) => c.connected);

  res.json({
    status: allConnected ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    collectors,
  });
});

export const healthRoutes = router;
