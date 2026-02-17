import { getToken } from './auth';

export async function sendVictronMode(mode: string): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  try {
    const res = await fetch('/api/victron/mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ mode }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Erreur reseau' };
  }
}
