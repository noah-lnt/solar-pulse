import type { DailySummary } from './types';

function percent(part: number, whole: number): number {
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

export function computeRates(d: DailySummary) {
  const autoconso = d.pvYieldKwh < 0.01 ? 0
    : percent(d.pvYieldKwh - Math.min(d.pvYieldKwh, d.linkyExportKwh), d.pvYieldKwh);
  const autosuff = d.consumptionKwh < 0.01 ? 0
    : percent(d.consumptionKwh - Math.min(d.consumptionKwh, d.linkyImportKwh), d.consumptionKwh);
  return { autoconso, autosuff };
}

export function localDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
