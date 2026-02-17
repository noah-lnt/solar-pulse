import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPower(watts: number): string {
  if (Math.abs(watts) >= 1000) {
    return `${(watts / 1000).toFixed(1)} kW`;
  }
  return `${Math.round(watts)} W`;
}

export function formatEnergy(wh: number): string {
  if (Math.abs(wh) >= 1000000) {
    return `${(wh / 1000000).toFixed(1)} MWh`;
  }
  if (Math.abs(wh) >= 1000) {
    return `${(wh / 1000).toFixed(1)} kWh`;
  }
  return `${Math.round(wh)} Wh`;
}

export function formatVoltage(v: number): string {
  return `${v.toFixed(1)} V`;
}

export function formatCurrent(a: number): string {
  return `${a.toFixed(2)} A`;
}

export function formatTemperature(c: number): string {
  return `${c.toFixed(0)}°C`;
}

export function formatPercent(p: number): string {
  return `${p.toFixed(1)}%`;
}
