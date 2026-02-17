import { Router } from 'express';
import { getCurrentState } from '../aggregator';

const router = Router();

router.get('/', (_req, res) => {
  const state = getCurrentState();
  if (!state) {
    res.status(503).json({ error: 'Donnees pas encore disponibles' });
    return;
  }
  res.json(state);
});

export const statusRoutes = router;
