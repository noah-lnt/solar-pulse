import { useState } from 'react';
import { Sun, Battery, Zap, Power, PowerOff, TrendingUp, Home } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PVProductionChart } from '@/components/panels/PVProductionChart';
import { cn, formatPower } from '@/lib/utils';
import { sendVictronMode } from '@/lib/api';
import { computeRates } from '@/lib/energy';
import { useTodayEnergy } from '@/hooks/useTodayEnergy';
import type { SystemState, HistoryPoint } from '@/lib/types';

interface OverviewPageProps {
  state: SystemState | null;
  history: HistoryPoint[];
}

function BatteryCard({ title, soc, power, status, color }: {
  title: string;
  soc: number;
  power: number;
  status: string;
  color: string;
}) {
  const statusLabel = {
    charging: 'Charge',
    discharging: 'Decharge',
    idle: 'Veille',
    offline: 'Hors ligne',
  }[status] || status;

  const statusColor = {
    charging: 'text-emerald-400',
    discharging: 'text-orange-400',
    idle: 'text-zinc-400',
    offline: 'text-red-400',
  }[status] || 'text-zinc-400';

  const socColor = soc > 60 ? 'bg-emerald-500' : soc > 20 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <Card className="border-border bg-card/50">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Battery className={`h-4 w-4 ${color}`} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{soc.toFixed(0)}%</span>
          <span className={`text-xs ${statusColor}`}>{statusLabel}</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full transition-all', socColor)} style={{ width: `${soc}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{formatPower(Math.abs(power))}</p>
      </CardContent>
    </Card>
  );
}

export function OverviewPage({ state, history }: OverviewPageProps) {
  const [victronLoading, setVictronLoading] = useState(false);

  const today = useTodayEnergy();

  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        En attente des donnees...
      </div>
    );
  }

  const victronOn = state.victron.mode !== 'off';
  const paidLinky = state.computed.consumptionSource === 'linky';
  const rates = today ? computeRates(today) : null;
  const gridPower = state.grid.totalPower;

  const gridLabel = victronOn
    ? (gridPower > 0 ? 'Depuis Victron' : 'Vers Victron')
    : (gridPower > 0 ? 'Import reseau' : 'Export reseau');

  const handleVictronToggle = async () => {
    setVictronLoading(true);
    await sendVictronMode(victronOn ? 'off' : 'on');
    setVictronLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. Production PV */}
        <Card className="border-border bg-card/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Production PV</span>
            </div>
            <span className="text-2xl font-bold text-amber-500">{formatPower(state.pv.powerNow)}</span>
            <p className="mt-1 text-xs text-muted-foreground">{state.pv.todayYield.toFixed(1)} kWh aujourd'hui</p>
          </CardContent>
        </Card>

        {/* 2. Batterie LiFePO4 */}
        <BatteryCard
          title="LiFePO4"
          soc={state.lifepoDiy.soc}
          power={state.lifepoDiy.power}
          status={state.lifepoDiy.status}
          color="text-purple-400"
        />

        {/* 3. Shelly + Victron switch */}
        <Card className="border-border bg-card/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className={`h-4 w-4 ${gridPower > 0 ? 'text-red-500' : 'text-violet-500'}`} />
                <span className="text-sm font-medium">Shelly</span>
              </div>
              {/* Victron ON/OFF toggle */}
              <button
                onClick={handleVictronToggle}
                disabled={victronLoading}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-colors',
                  victronOn
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30',
                  victronLoading && 'opacity-50 cursor-not-allowed',
                )}
                title={victronOn ? 'Eteindre Victron' : 'Allumer Victron'}
              >
                {victronOn ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                <span>Victron {victronOn ? 'ON' : 'OFF'}</span>
              </button>
            </div>
            <span className={`text-2xl font-bold ${gridPower > 0 ? 'text-red-500' : 'text-violet-500'}`}>
              {formatPower(Math.abs(gridPower))}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <Badge className={cn('text-[10px]', gridPower > 0 ? 'bg-red-500/20 text-red-400' : 'bg-violet-500/20 text-violet-400')}>
                {gridLabel}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consommation + Autoconsommation + Autosuffisance */}
      <Card className="border-border bg-card/50">
        <CardContent className="py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium">Conso.</span>
                <span className="text-xl font-bold text-blue-400">{formatPower(state.computed.consumption)}</span>
                <Badge className={cn('text-[10px]', paidLinky ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400')}>
                  {paidLinky ? 'Linky (payant)' : 'Solaire + batterie'}
                </Badge>
              </div>
              {rates && (
                <>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium">Autoconso.</span>
                    <span className="text-xl font-bold text-emerald-400">{rates.autoconso}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium">Autosuffisance</span>
                    <span className="text-xl font-bold text-amber-400">{rates.autosuff}%</span>
                  </div>
                </>
              )}
            </div>
            {today && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span>PV: {today.pvYieldKwh.toFixed(1)} kWh</span>
                <span>Conso.: {today.consumptionKwh.toFixed(1)} kWh</span>
                <span>Charge: {today.chargeKwh.toFixed(1)} kWh</span>
                <span>Decharge: {today.dischargeKwh.toFixed(1)} kWh</span>
                <span>Linky import: {today.linkyImportKwh.toFixed(1)} kWh</span>
                <span>Linky export: {today.linkyExportKwh.toFixed(1)} kWh</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <PVProductionChart history={history} />
    </div>
  );
}
