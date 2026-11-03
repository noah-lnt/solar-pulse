import { getTimes } from 'suncalc';

export interface SunWindow {
  sunrise: Date | null;
  sunset: Date | null;
}

// One window per local day, today first, `days` days in all.
export function sunWindows(days: number, latitude: number, longitude: number, now = new Date()): SunWindow[] {
  const windows: SunWindow[] = [];
  for (let i = 0; i < days; i++) {
    const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12);
    const { sunrise, sunset } = getTimes(noon, latitude, longitude);
    windows.push({ sunrise, sunset });
  }
  return windows;
}
