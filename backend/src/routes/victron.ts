import { Router } from 'express';
import { setVictronMode, isVictronMqttReady } from '../collectors/victron.collector';

const router = Router();

// POST /api/victron/mode
// Body: { "mode": "on" | "off" | "charger" | "inverter" }
router.post('/mode', (req, res) => {
  const { mode } = req.body as { mode?: string };

  if (!mode || !['on', 'off', 'charger', 'inverter'].includes(mode)) {
    res.status(400).json({ error: 'Mode invalide. Valeurs possibles: on, off, charger, inverter' });
    return;
  }

  if (!isVictronMqttReady()) {
    res.status(503).json({ error: 'Victron MQTT non connecte' });
    return;
  }

  const result = setVictronMode(mode as 'on' | 'off' | 'charger' | 'inverter');

  if (result.success) {
    console.log(`[API] Victron mode set to: ${mode}`);
    res.json({ success: true, mode });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// GET /api/victron/mqtt-status
router.get('/mqtt-status', (_req, res) => {
  res.json({ connected: isVictronMqttReady() });
});

export const victronRoutes = router;
