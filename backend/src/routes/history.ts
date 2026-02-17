import { Router } from 'express';
import { getHistory } from '../aggregator';

const router = Router();

router.get('/', (req, res) => {
  const range = (req.query.range as string) || '24h';
  let points = getHistory();

  // Filter by range
  if (range !== '24h') {
    const hours = parseInt(range.replace('h', ''), 10) || 24;
    const cutoff = Date.now() - hours * 3600 * 1000;
    points = points.filter((p) => new Date(p.timestamp).getTime() > cutoff);
  }

  res.json(points);
});

export const historyRoutes = router;
