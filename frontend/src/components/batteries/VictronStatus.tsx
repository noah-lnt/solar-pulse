import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatPower, formatVoltage } from '@/lib/utils';
import { sendVictronMode } from '@/lib/api';
import { Power, PowerOff } from 'lucide-react';
import type { VictronData } from '@/lib/types';

interface VictronStatusProps {
  data: VictronData;
}

export function VictronStatus({ data }: VictronStatusProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modeLabel = {
    off: 'Eteint',
    inverting: 'Onduleur',
    charging: 'Chargeur',
    passthrough: 'Bypass',
  }[data.mode];

  const modeColor = {
    off: 'bg-zinc-500/20 text-zinc-400',
    inverting: 'bg-orange-500/20 text-orange-400',
    charging: 'bg-emerald-500/20 text-emerald-400',
    passthrough: 'bg-blue-500/20 text-blue-400',
  }[data.mode];

  const isOn = data.mode !== 'off';

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    const result = await sendVictronMode(isOn ? 'off' : 'on');
    if (!result.success) setError(result.error || 'Erreur');
    setLoading(false);
  };

  const handleSetMode = async (mode: string) => {
    setLoading(true);
    setError(null);
    const result = await sendVictronMode(mode);
    if (!result.success) setError(result.error || 'Erreur');
    setLoading(false);
  };

  const modeButtons: { key: string; label: string; matchMode: VictronData['mode'] }[] = [
    { key: 'on', label: 'On', matchMode: 'passthrough' },
    { key: 'charger', label: 'Chargeur', matchMode: 'charging' },
    { key: 'inverter', label: 'Onduleur', matchMode: 'inverting' },
    { key: 'off', label: 'Off', matchMode: 'off' },
  ];

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Victron MultiPlus</CardTitle>
        <div className="flex items-center gap-2">
          <Badge className={cn('text-xs', modeColor)}>{modeLabel}</Badge>
          <button
            onClick={handleToggle}
            disabled={loading}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              isOn
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30',
              loading && 'opacity-50 cursor-not-allowed',
            )}
            title={isOn ? 'Eteindre le Victron' : 'Allumer le Victron'}
          >
            {isOn ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">AC Entree</span>
            <p className="font-medium">{formatVoltage(data.inputVoltage)}</p>
            <p className="text-xs text-muted-foreground">{data.inputFrequency.toFixed(1)} Hz</p>
          </div>
          <div>
            <span className="text-muted-foreground">AC Sortie</span>
            <p className="font-medium">{formatVoltage(data.outputVoltage)}</p>
            <p className="text-xs text-muted-foreground">{data.outputFrequency.toFixed(1)} Hz</p>
          </div>
          <div>
            <span className="text-muted-foreground">Puissance sortie</span>
            <p className="font-medium">{formatPower(data.outputPower)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Charge</span>
            <p className="font-medium">{data.loadPercent}%</p>
          </div>
        </div>

        {/* Mode controls */}
        <div className="mt-3 flex gap-2">
          {modeButtons.map(({ key, label, matchMode }) => {
            const isActive = data.mode === matchMode;
            return (
              <button
                key={key}
                onClick={() => handleSetMode(key)}
                disabled={loading || isActive}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  (loading || isActive) && 'opacity-50 cursor-not-allowed',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}

        {(data.warnings.length > 0 || data.alarms.length > 0) && (
          <div className="mt-3 space-y-1">
            {data.alarms.map((a, i) => (
              <Badge key={`alarm-${i}`} variant="destructive" className="mr-1 text-xs">{a}</Badge>
            ))}
            {data.warnings.map((w, i) => (
              <Badge key={`warn-${i}`} className="mr-1 bg-amber-500/20 text-xs text-amber-400">{w}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
