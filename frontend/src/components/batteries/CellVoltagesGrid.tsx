import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LiFePO4DiyData } from '@/lib/types';

interface CellVoltagesGridProps {
  data: LiFePO4DiyData;
}

function getCellColor(voltage: number, min: number, max: number): string {
  const delta = max - min;
  if (voltage < 2.8 || voltage > 3.65) return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (delta > 0.05) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
}

function CellGrid({ cells, label, min, max }: { cells: number[]; label: string; min: number; max: number }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground mb-2">{label} — {cells.length} cellules</h4>
      <div className="grid grid-cols-4 gap-2">
        {cells.map((v, i) => (
          <div
            key={i}
            className={cn(
              'rounded-md border p-2 text-center',
              getCellColor(v, min, max)
            )}
          >
            <div className="text-[10px] text-muted-foreground">C{i + 1}</div>
            <div className="text-sm font-mono font-medium">{v.toFixed(3)}V</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CellVoltagesGrid({ data }: CellVoltagesGridProps) {
  const hasPacks = data.batteryPacks && data.batteryPacks.length > 1;

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-purple-400">Cellules LiFePO4</CardTitle>
          <span className="text-xs text-muted-foreground">
            Delta: <span className={cn('font-medium', data.cellDelta > 20 ? 'text-amber-400' : 'text-emerald-400')}>
              {data.cellDelta} mV
            </span>
            {hasPacks && (
              <span className="ml-2">({data.batteryPacks.length} packs)</span>
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {hasPacks ? (
          <div className="space-y-4">
            {data.batteryPacks.map((pack, idx) => (
              <CellGrid
                key={pack.id}
                cells={pack.cells}
                label={`Pack ${idx + 1}`}
                min={data.minCellVoltage}
                max={data.maxCellVoltage}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {data.cellVoltages.map((v, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-md border p-2 text-center',
                  getCellColor(v, data.minCellVoltage, data.maxCellVoltage)
                )}
              >
                <div className="text-[10px] text-muted-foreground">C{i + 1}</div>
                <div className="text-sm font-mono font-medium">{v.toFixed(3)}V</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>Min: {data.minCellVoltage.toFixed(3)}V</span>
          <span>Max: {data.maxCellVoltage.toFixed(3)}V</span>
          <span>BMS: {data.bmsTemperature}°C</span>
          {data.balancing && (
            <span className="text-amber-400">Equilibrage actif</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
