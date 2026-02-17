import { useState, useEffect, useCallback } from 'react';
import type { SystemState, HistoryPoint } from '@/lib/types';
import { getToken } from '@/lib/auth';

const MAX_HISTORY = 1440;

export function useSystemState(lastWsState: SystemState | null) {
  const [state, setState] = useState<SystemState | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [lastMinute, setLastMinute] = useState(-1);

  // Fetch initial history on mount
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch('/api/history?range=24h', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : [])
      .then((data: HistoryPoint[]) => setHistory(data))
      .catch(() => {});
  }, []);

  // Update state from WS
  useEffect(() => {
    if (!lastWsState) return;
    setState(lastWsState);

    const now = new Date(lastWsState.timestamp);
    const currentMinute = now.getHours() * 60 + now.getMinutes();

    if (currentMinute !== lastMinute) {
      setLastMinute(currentMinute);
      setHistory((prev) => {
        const point: HistoryPoint = {
          timestamp: lastWsState.timestamp,
          pvPower: lastWsState.pv.powerNow,
          gridPower: lastWsState.grid.totalPower,
          batteryPower: lastWsState.computed.totalBatteryPower,
          consumption: lastWsState.pv.powerNow + lastWsState.computed.totalBatteryPower + lastWsState.grid.totalPower,
          gridImportWh: lastWsState.grid.totalImportWh,
          gridExportWh: lastWsState.grid.totalExportWh,
          ms2aSoc: lastWsState.ms2a.soc,
          ms2aPower: lastWsState.ms2a.power,
          lifepeSoc: lastWsState.lifepoDiy.soc,
          lifepePower: lastWsState.lifepoDiy.power,
          victronMode: lastWsState.victron.mode,
        };
        const next = [...prev, point];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });
    }
  }, [lastWsState, lastMinute]);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setState(await res.json());
    } catch {
      // ignore
    }
  }, []);

  return { state, history, refresh };
}
