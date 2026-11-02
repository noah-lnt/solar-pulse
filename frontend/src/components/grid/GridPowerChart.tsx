import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { useChartTheme } from '@/hooks/useChartTheme';
import { formatPower } from '@/lib/utils';
import type { HistoryPoint } from '@/lib/types';

interface GridPowerChartProps {
  history: HistoryPoint[];
}

interface Bucket {
  time: string;
  import: number;
  export: number;
  victronOn: boolean;
}

const IMPORT_COLOR = '#ef4444';
const EXPORT_COLOR = '#8b5cf6';
const BUCKET_MINUTES = 5;

// One point per minute is up to 1,440 points: average them per 5 minutes so the chart stays readable.
function toBuckets(history: HistoryPoint[]): Bucket[] {
  const buckets: Bucket[] = [];
  let key = '';
  let sum = 0;
  let count = 0;

  const flush = (last: HistoryPoint) => {
    const avg = Math.round(sum / count);
    buckets.push({
      time: key,
      import: Math.max(0, avg),
      export: Math.min(0, avg),
      victronOn: last.victronMode !== 'off',
    });
  };

  let previous: HistoryPoint | null = null;
  for (const point of history) {
    const date = new Date(point.timestamp);
    date.setMinutes(date.getMinutes() - (date.getMinutes() % BUCKET_MINUTES), 0, 0);
    const pointKey = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
    if (pointKey !== key && previous) {
      flush(previous);
      sum = 0;
      count = 0;
    }
    key = pointKey;
    sum += point.gridPower;
    count++;
    previous = point;
  }
  if (previous) flush(previous);
  return buckets;
}

function roundTicks(data: Bucket[]): number[] {
  const lo = data.reduce((m, b) => Math.min(m, b.export), 0);
  const hi = data.reduce((m, b) => Math.max(m, b.import), 0);
  const step = [250, 500, 1000, 2000, 5000].find((s) => (hi - lo) / s <= 6) ?? 5000;
  const ticks: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step; t += step) ticks.push(t);
  return ticks;
}

export function GridPowerChart({ history }: GridPowerChartProps) {
  const theme = useChartTheme();
  const data = toBuckets(history);
  const ticks = roundTicks(data);
  const axisTick = { fill: theme.textMuted, fontSize: 11 };

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle>Echanges reseau (24h)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
              <XAxis dataKey="time" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
              <YAxis
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={55}
                ticks={ticks}
                domain={[ticks[0] ?? 0, ticks[ticks.length - 1] ?? 0]}
                tickFormatter={(v: number) => formatPower(v)}
              />
              <ReferenceLine y={0} stroke={theme.textMuted} strokeOpacity={0.5} />
              <Tooltip
                wrapperStyle={{ zIndex: 50 }}
                content={({ active, payload, label }) => {
                  const bucket = payload?.[0]?.payload as Bucket | undefined;
                  if (!active || !bucket) return null;
                  const exporting = bucket.export < 0;
                  const name = bucket.victronOn
                    ? (exporting ? 'Vers Victron' : 'Depuis Victron')
                    : (exporting ? 'Export' : 'Import');
                  return (
                    <ChartTooltip
                      title={label}
                      rows={[{
                        label: name,
                        value: formatPower(Math.abs(exporting ? bucket.export : bucket.import)),
                        color: exporting ? EXPORT_COLOR : IMPORT_COLOR,
                      }]}
                    />
                  );
                }}
              />
              <Area type="monotone" dataKey="import" stroke={IMPORT_COLOR} fill={IMPORT_COLOR} fillOpacity={0.25} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="export" stroke={EXPORT_COLOR} fill={EXPORT_COLOR} fillOpacity={0.25} strokeWidth={2} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
