import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getToken } from '@/lib/auth';
import type { DailySummary, DailyHistoryResponse } from '@/lib/types';

const PERIODS = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '6m', label: '6 mois' },
] as const;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function Cell({ value, unit = 'kWh' }: { value: number; unit?: string }) {
  return (
    <td className="px-3 py-2 text-right tabular-nums">
      {value.toFixed(1)} <span className="text-muted-foreground text-[10px]">{unit}</span>
    </td>
  );
}

export function HistoriquePage() {
  const [period, setPeriod] = useState<string>('7d');
  const [data, setData] = useState<{ days: DailySummary[]; averages: DailySummary } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/history/daily?period=${p}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json: DailyHistoryResponse = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('[Historique] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              'rounded-full px-3 py-1 text-sm font-medium transition-colors',
              period === p.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Card className="border-border bg-card/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              Chargement...
            </div>
          ) : !data || data.days.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              Pas de donnees pour cette periode
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">PV</th>
                    <th className="px-3 py-2 text-right font-medium">Charge</th>
                    <th className="px-3 py-2 text-right font-medium">Decharge</th>
                    <th className="px-3 py-2 text-right font-medium">Import</th>
                    <th className="px-3 py-2 text-right font-medium">Export</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((day) => (
                    <tr key={day.date} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{formatDate(day.date)}</td>
                      <Cell value={day.pvYieldKwh} />
                      <Cell value={day.chargeKwh} />
                      <Cell value={day.dischargeKwh} />
                      <Cell value={day.gridImportKwh} />
                      <Cell value={day.gridExportKwh} />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-3 py-2">Moyenne / jour</td>
                    <Cell value={data.averages.pvYieldKwh} />
                    <Cell value={data.averages.chargeKwh} />
                    <Cell value={data.averages.dischargeKwh} />
                    <Cell value={data.averages.gridImportKwh} />
                    <Cell value={data.averages.gridExportKwh} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
