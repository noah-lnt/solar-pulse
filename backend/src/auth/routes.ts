import { Router } from 'express';
import { pool } from '../db';
import { config } from '../config';
import { hashPassword, comparePassword, generateToken } from './utils';
import { AuthRequest } from './middleware';

const router = Router();

router.post('/register', async (req: AuthRequest, res) => {
  try {
    const { email, password, secret } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caracteres' });
      return;
    }

    // Verify registration secret if configured (skip for authenticated users)
    if (config.registerSecret && !req.user) {
      if (!secret || secret !== config.registerSecret) {
        res.status(403).json({ error: 'Code d\'inscription invalide' });
        return;
      }
    }

    // Allow registration only if no users exist or if authenticated
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(countResult.rows[0].count, 10);

    if (userCount > 0 && !req.user) {
      res.status(403).json({ error: 'Inscription fermee. Contactez un administrateur.' });
      return;
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Cet email est deja utilise' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.email);

    res.status(201).json({ user: { id: user.id, email: user.email }, token });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }

    const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Identifiants incorrects' });
      return;
    }

    const user = result.rows[0];
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Identifiants incorrects' });
      return;
    }

    const token = generateToken(user.id, user.email);
    res.json({ user: { id: user.id, email: user.email }, token });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/me', (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Non authentifie' });
    return;
  }
  res.json({ user: req.user });
});

export const authRoutes = router;
