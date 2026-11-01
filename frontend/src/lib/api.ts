import { authFetch } from './auth';

export async function sendVictronMode(mode: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authFetch('/api/victron/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Erreur reseau' };
  }
}
