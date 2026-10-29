import { useState, useEffect } from 'react';
import type { DailySummary, DailyHistoryResponse } from '@/lib/types';
import { getToken } from '@/lib/auth';
import { localDate } from '@/lib/energy';

const REFRESH_MS = 5 * 60_000;

export function useTodayEnergy(): DailySummary | null {
  const [today, setToday] = useState<DailySummary | null>(null);

  useEffect(() => {
    const load = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch('/api/history/daily?period=7d', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: DailyHistoryResponse = await res.json();
        setToday(data.days.find((d) => d.date === localDate(new Date())) ?? null);
      } catch {
        // keep the last value
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return today;
}
