import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { HistoryPoint } from '@/lib/types';

interface GridPowerChartProps {
  history: HistoryPoint[];
}

export function GridPowerChart({ history }: GridPowerChartProps) {
  const data = history.map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    }),
    power: p.gridPower,
  }));

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle>Echanges reseau (24h)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis
                dataKey="time"
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}W`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value: number) => [`${value}W`, value > 0 ? 'Import' : 'Export']}
              />
              <Bar dataKey="power" name="Reseau">
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.power > 0 ? '#ef4444' : '#8b5cf6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
