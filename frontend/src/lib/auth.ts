// The session lives in an httpOnly cookie set by the backend: JavaScript never sees the token.

// A 401 means the session expired: reload, which runs checkAuth and shows the login page.
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    window.location.reload();
  }
  return res;
}

async function postJson(url: string, body: unknown, fallbackError: string): Promise<{ id: number; email: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || fallbackError);
  }
  return data.user;
}

export function login(email: string, password: string, remember: boolean) {
  return postJson('/api/auth/login', { email, password, remember }, 'Erreur de connexion');
}

export function register(email: string, password: string, secret: string) {
  return postJson('/api/auth/register', { email, password, secret }, 'Erreur d\'inscription');
}

export async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/me');
    return res.ok;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // the cookie stays until it expires
  }
}
