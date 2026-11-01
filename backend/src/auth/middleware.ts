import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './utils';
import { readSession } from './session';

export interface AuthRequest extends Request {
  user?: { userId: number; email: string };
}

const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/logout', '/api/health'];

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

  const token = readSession(req.headers.cookie);
  if (!token) {
    res.status(401).json({ error: 'Non authentifie' });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expire' });
  }
}
