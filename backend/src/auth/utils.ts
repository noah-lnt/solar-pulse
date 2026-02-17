import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, config.jwtSecret, {
    expiresIn: 86400, // 24 hours in seconds
  });
}

export function verifyToken(token: string): { userId: number; email: string } {
  return jwt.verify(token, config.jwtSecret) as { userId: number; email: string };
}
