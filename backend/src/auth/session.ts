import { Response } from 'express';

const COOKIE_NAME = 'solarpulse_session';
export const REMEMBER_SECONDS = 30 * 24 * 3600;
export const SESSION_SECONDS = 24 * 3600;

export function readSession(cookieHeader: string | undefined): string | null {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(value.join('='));
  }
  return null;
}

export function setSessionCookie(res: Response, token: string, remember: boolean): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    ...(remember ? { maxAge: REMEMBER_SECONDS * 1000 } : {}),
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
}
