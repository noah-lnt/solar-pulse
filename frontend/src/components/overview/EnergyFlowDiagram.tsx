import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sun, Battery, Home, Zap } from 'lucide-react';
import type { SystemState } from '@/lib/types';
import { formatPower } from '@/lib/utils';

interface EnergyFlowDiagramProps {
  state: SystemState;
}

function FlowArrow({ power, from, to, colorPos, colorNeg }: {
  power: number;
  from: string;
  to: string;
  colorPos: string;
  colorNeg: string;
}) {
  if (Math.abs(power) < 5) return null;
  const isPositive = power > 0;
  const color = isPositive ? colorPos : colorNeg;
  const direction = isPositive ? `${from} → ${to}` : `${to} → ${from}`;
  const width = Math.min(4, Math.max(1, Math.abs(power) / 500));

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-xs font-medium ${color}`}>{formatPower(Math.abs(power))}</span>
      <div className={`h-0.5 w-16 ${color.replace('text-', 'bg-')}`} style={{ height: `${width}px` }} />
      <span className="text-[10px] text-muted-foreground">{direction}</span>
    </div>
  );
}

function BatteryNode({ label, soc, power }: {
  label: string;
  soc: number;
  power: number;
}) {
  const isCharging = power < 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isCharging ? 'bg-emerald-500/10' : 'bg-orange-500/10'}`}>
        <Battery className={`h-5 w-5 ${isCharging ? 'text-emerald-500' : 'text-orange-500'}`} />
      </div>
      <span className="text-xs font-medium">{soc.toFixed(0)}%</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function EnergyFlowDiagram({ state }: EnergyFlowDiagramProps) {
  const pvPower = state.pv.powerNow;
  const batteryPower = state.computed.totalBatteryPower;
  const gridPower = state.grid.totalPower;
  const consumption = pvPower + batteryPower + gridPower;

  const victronOn = state.victron.mode !== 'off';
  const ms2aOnline = state.ms2a.status !== 'offline';
  const lifepoOnline = state.lifepoDiy.status !== 'offline';

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle>Flux d'energie</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          {/* PV */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
              <Sun className="h-7 w-7 text-amber-500" />
            </div>
            <span className="text-xs font-medium text-amber-500">{formatPower(pvPower)}</span>
            <span className="text-[10px] text-muted-foreground">Production</span>
          </div>

          <FlowArrow power={pvPower} from="PV" to="Maison" colorPos="text-amber-500" colorNeg="text-amber-500" />

          {/* Maison */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
              <Home className="h-7 w-7 text-blue-500" />
            </div>
            <span className="text-xs font-medium text-blue-500">{formatPower(Math.max(0, consumption))}</span>
            <span className="text-[10px] text-muted-foreground">Consommation</span>
          </div>

          <FlowArrow
            power={gridPower}
            from={victronOn ? 'Victron' : 'Reseau'}
            to="Maison"
            colorPos="text-red-500"
            colorNeg="text-violet-500"
          />

          {/* Grid / Victron */}
          <div className="flex flex-col items-center gap-1">
            <div className={`flex h-14 w-14 items-center justify-center rounded-full ${gridPower > 0 ? 'bg-red-500/10' : 'bg-violet-500/10'}`}>
              <Zap className={`h-7 w-7 ${gridPower > 0 ? 'text-red-500' : 'text-violet-500'}`} />
            </div>
            <span className={`text-xs font-medium ${gridPower > 0 ? 'text-red-500' : 'text-violet-500'}`}>
              {formatPower(Math.abs(gridPower))}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {victronOn
                ? (gridPower > 0 ? 'Depuis Victron' : 'Vers Victron')
                : (gridPower > 0 ? 'Import' : 'Export')
              }
            </span>
          </div>
        </div>

        {/* Batteries section */}
        <div className="mt-4 flex items-center justify-center gap-6">
          <FlowArrow
            power={batteryPower}
            from="Batteries"
            to="Maison"
            colorPos="text-orange-500"
            colorNeg="text-emerald-500"
          />

          <div className="flex gap-4">
            {/* MS-2A */}
            {ms2aOnline ? (
              <BatteryNode
                label="MS-2A"
                soc={state.ms2a.soc}
                power={state.ms2a.power}
              />
            ) : (
              <div className="flex flex-col items-center gap-1 opacity-40">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-500/10">
                  <Battery className="h-5 w-5 text-zinc-500" />
                </div>
                <span className="text-xs text-zinc-500">--</span>
                <span className="text-[10px] text-zinc-500">MS-2A</span>
              </div>
            )}

            {/* LiFePO4 */}
            {lifepoOnline ? (
              <BatteryNode
                label="LiFePO4"
                soc={state.lifepoDiy.soc}
                power={state.lifepoDiy.power}
              />
            ) : (
              <div className="flex flex-col items-center gap-1 opacity-40">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-500/10">
                  <Battery className="h-5 w-5 text-zinc-500" />
                </div>
                <span className="text-xs text-zinc-500">--</span>
                <span className="text-[10px] text-zinc-500">LiFePO4</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
