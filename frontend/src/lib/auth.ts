const TOKEN_KEY = 'solarpulse_token';

let token: string | null = sessionStorage.getItem(TOKEN_KEY);

export function getToken(): string | null {
  return token;
}

export function setToken(t: string | null): void {
  token = t;
  if (t) {
    sessionStorage.setItem(TOKEN_KEY, t);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function isAuthenticated(): boolean {
  return token !== null;
}

export async function login(email: string, password: string): Promise<{ id: number; email: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Erreur de connexion');
  }

  const data = await res.json();
  setToken(data.token);
  return data.user;
}

export async function register(email: string, password: string): Promise<{ id: number; email: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Erreur d\'inscription');
  }

  const data = await res.json();
  setToken(data.token);
  return data.user;
}

export async function checkAuth(): Promise<boolean> {
  if (!token) return false;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setToken(null);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function logout(): void {
  setToken(null);
}
