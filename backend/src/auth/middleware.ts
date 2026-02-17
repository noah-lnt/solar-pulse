import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './utils';

export interface AuthRequest extends Request {
  user?: { userId: number; email: string };
}

const PUBLIC_PATHS = ['/api/auth/login', '/api/health'];

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (PUBLIC_PATHS.includes(req.path)) {
    next();
    return;
  }

  // Allow register only when no users exist (handled in route)
  if (req.path === '/api/auth/register') {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requis' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expire' });
  }
}
