import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { useChartTheme } from '@/hooks/useChartTheme';
import { formatPower } from '@/lib/utils';
import type { HistoryPoint } from '@/lib/types';

interface PVProductionChartProps {
  history: HistoryPoint[];
}

export function PVProductionChart({ history }: PVProductionChartProps) {
  const theme = useChartTheme();
  // Resample to 5-minute intervals for cleaner display
  const resampled: { time: string; production: number }[] = [];
  let lastBucket = -1;

  for (const point of history) {
    const date = new Date(point.timestamp);
    const minuteOfDay = date.getHours() * 60 + date.getMinutes();
    const bucket = Math.floor(minuteOfDay / 5);

    if (bucket !== lastBucket) {
      lastBucket = bucket;
      resampled.push({
        time: date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Paris',
        }),
        production: Math.max(0, Math.round(point.pvPower)),
      });
    }
  }

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle>Production solaire (24h)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={resampled}>
              <defs>
                <linearGradient id="gradPV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: theme.textMuted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: theme.textMuted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}kW` : `${v}W`}
              />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <ChartTooltip
                      title={label}
                      rows={[{ label: 'Production', value: formatPower(Number(payload[0]?.value ?? 0)), color: '#f59e0b' }]}
                    />
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="production"
                stroke="#f59e0b"
                fill="url(#gradPV)"
                strokeWidth={2}
                dot={false}
                name="Production"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
