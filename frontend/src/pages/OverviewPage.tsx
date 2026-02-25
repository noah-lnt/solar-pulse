import { useState, useMemo } from 'react';
import { Sun, Battery, Zap, Power, PowerOff, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PVProductionChart } from '@/components/panels/PVProductionChart';
import { cn, formatPower } from '@/lib/utils';
import { sendVictronMode } from '@/lib/api';
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

function computeDailyEnergy(history: HistoryPoint[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const todayPoints = history.filter(p => new Date(p.timestamp).getTime() >= todayMs);
  if (todayPoints.length < 2) return null;

  const first = todayPoints[0]!;
  const last = todayPoints[todayPoints.length - 1]!;

  const dailyExportKwh = Math.max(0, (last.gridExportWh - first.gridExportWh) / 1000);
  const dailyImportKwh = Math.max(0, (last.gridImportWh - first.gridImportWh) / 1000);

  // Charge/decharge batterie : integration des puissances minute par minute
  // Convention SolarPulse : negatif = charge, positif = decharge
  let chargeWh = 0;
  let dischargeWh = 0;
  // LiFePO4 via Victron passe par le Shelly → il faut le soustraire des compteurs Shelly
  let lifepoChargeWh = 0;
  let lifepoDischargeWh = 0;
  for (const p of todayPoints) {
    const ms2a = p.ms2aPower ?? 0;
    const lifepo = p.lifepePower ?? 0;
    const totalBatPower = ms2a + lifepo;
    if (totalBatPower < 0) {
      chargeWh += Math.abs(totalBatPower) / 60; // W * (1min / 60) = Wh
    } else if (totalBatPower > 0) {
      dischargeWh += totalBatPower / 60;
    }
    // Tracker LiFePO4 separement (transite par Shelly via Victron)
    if (lifepo < 0) lifepoChargeWh += Math.abs(lifepo) / 60;
    else if (lifepo > 0) lifepoDischargeWh += lifepo / 60;
  }

  // Corriger les compteurs Shelly : retirer les flux Victron/LiFePO4
  // Charge LiFePO4 = Shelly voit "export" mais c'est de la charge batterie
  // Decharge LiFePO4 = Shelly voit "import" mais c'est de la decharge batterie
  const realExportKwh = Math.max(0, dailyExportKwh - lifepoChargeWh / 1000);
  const realImportKwh = Math.max(0, dailyImportKwh - lifepoDischargeWh / 1000);

  return {
    dailyExportKwh: realExportKwh,
    dailyImportKwh: realImportKwh,
    dailyChargeKwh: Math.round(chargeWh / 10) / 100,
    dailyDischargeKwh: Math.round(dischargeWh / 10) / 100,
  };
}

export function OverviewPage({ state, history }: OverviewPageProps) {
  const [victronLoading, setVictronLoading] = useState(false);

  const dailyEnergy = useMemo(() => computeDailyEnergy(history), [history]);

  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        En attente des donnees...
      </div>
    );
  }

  const victronOn = state.victron.mode !== 'off';
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* 2. Batterie MS-2A */}
        <BatteryCard
          title="MS-2A"
          soc={state.ms2a.soc}
          power={state.ms2a.power}
          status={state.ms2a.status}
          color="text-emerald-400"
        />

        {/* 3. Batterie LiFePO4 */}
        <BatteryCard
          title="LiFePO4"
          soc={state.lifepoDiy.soc}
          power={state.lifepoDiy.power}
          status={state.lifepoDiy.status}
          color="text-purple-400"
        />

        {/* 4. Shelly + Victron switch */}
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

      {/* Autoconsommation journaliere */}
      {state.pv.todayYield > 0 && dailyEnergy && (
        <Card className="border-border bg-card/50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium">Autoconsommation</span>
                <span className="text-xl font-bold text-emerald-400">
                  {Math.min(100, Math.max(0, Math.round((state.pv.todayYield - dailyEnergy.dailyExportKwh) / state.pv.todayYield * 100)))}%
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span>PV: {state.pv.todayYield.toFixed(1)} kWh</span>
                <span>Charge: {dailyEnergy.dailyChargeKwh.toFixed(1)} kWh</span>
                <span>Decharge: {dailyEnergy.dailyDischargeKwh.toFixed(1)} kWh</span>
                <span>Export: {dailyEnergy.dailyExportKwh.toFixed(1)} kWh</span>
                <span>Import: {dailyEnergy.dailyImportKwh.toFixed(1)} kWh</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <PVProductionChart history={history} />
    </div>
  );
}
