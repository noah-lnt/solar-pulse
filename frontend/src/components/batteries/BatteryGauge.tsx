import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatPower, formatVoltage, formatCurrent, formatTemperature } from '@/lib/utils';
import type { BatteryData } from '@/lib/types';

interface BatteryGaugeProps {
  title: string;
  data: BatteryData;
  color: string;
  showDetails?: boolean;
}

export function BatteryGauge({ title, data, color, showDetails = true }: BatteryGaugeProps) {
  const statusLabel = {
    charging: 'Charge',
    discharging: 'Decharge',
    idle: 'Veille',
    offline: 'Hors ligne',
  }[data.status];

  const statusColor = {
    charging: 'bg-emerald-500/20 text-emerald-400',
    discharging: 'bg-orange-500/20 text-orange-400',
    idle: 'bg-zinc-500/20 text-zinc-400',
    offline: 'bg-red-500/20 text-red-400',
  }[data.status];

  const socColor = data.soc > 60 ? 'bg-emerald-500' : data.soc > 20 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className={color}>{title}</CardTitle>
        <Badge className={cn('text-xs', statusColor)}>{statusLabel}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SoC bar */}
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>SoC</span>
            <span className="font-bold">{data.soc.toFixed(1)}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', socColor)}
              style={{ width: `${data.soc}%` }}
            />
          </div>
        </div>

        {/* Puissance toujours visible */}
        <div className="text-sm">
          <span className="text-muted-foreground">Puissance</span>
          <p className="font-medium">{formatPower(data.power)}</p>
        </div>

        {/* Details supplementaires (tension, courant, temp, capacite, cycles) */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Tension</span>
              <p className="font-medium">{formatVoltage(data.voltage)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Courant</span>
              <p className="font-medium">{formatCurrent(data.current)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Temperature</span>
              <p className="font-medium">{formatTemperature(data.temperature)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Capacite</span>
              <p className="font-medium">{data.capacityWh} Wh</p>
            </div>
            <div>
              <span className="text-muted-foreground">Cycles</span>
              <p className="font-medium">{data.cycles}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
