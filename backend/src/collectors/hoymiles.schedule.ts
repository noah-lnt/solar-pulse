import { getTimes } from 'suncalc';

// The Hoymiles station syncs every ~5 min: polling faster returns the same value.
export const POLL_INTERVAL_MS = 5 * 60_000;
// Hoymiles blacklisted our IP for over-polling: a failure waits, it never retries right away.
export const BACKOFF_BASE_MS = 30 * 60_000;
export const BACKOFF_MAX_MS = 6 * 60 * 60_000;

export function isDaylight(now: Date, latitude: number, longitude: number): boolean {
  const { sunrise, sunset } = getTimes(now, latitude, longitude);
  return sunrise !== null && sunset !== null && now >= sunrise && now < sunset;
}

export function nextPollAfterSuccess(now: number): number {
  return now + POLL_INTERVAL_MS;
}

export function backoffDelay(consecutiveFailures: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** (consecutiveFailures - 1), BACKOFF_MAX_MS);
}
