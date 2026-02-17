import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPower, formatEnergy } from '@/lib/utils';
import type { ShellyData } from '@/lib/types';

interface GridTotalsProps {
  data: ShellyData;
  victronOn?: boolean;
}

export function GridTotals({ data, victronOn = false }: GridTotalsProps) {
  const importLabel = victronOn ? 'Depuis Victron' : 'Import reseau';
  const exportLabel = victronOn ? 'Vers Victron' : 'Export reseau';
  const totalImportLabel = victronOn ? 'Total depuis Victron' : 'Total importe';
  const totalExportLabel = victronOn ? 'Total vers Victron' : 'Total exporte';

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle>{victronOn ? 'Echanges Victron' : 'Totaux reseau'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-sm text-muted-foreground">Puissance nette</span>
            <p className={`text-3xl font-bold ${data.totalPower > 0 ? 'text-red-400' : 'text-violet-400'}`}>
              {formatPower(Math.abs(data.totalPower))}
            </p>
            <span className={`text-sm ${data.totalPower > 0 ? 'text-red-400' : 'text-violet-400'}`}>
              {data.totalPower > 0 ? importLabel : exportLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-red-500/10 p-3 text-center">
              <span className="text-xs text-red-400">{totalImportLabel}</span>
              <p className="text-lg font-bold text-red-400">{formatEnergy(data.totalImportWh)}</p>
            </div>
            <div className="rounded-lg bg-violet-500/10 p-3 text-center">
              <span className="text-xs text-violet-400">{totalExportLabel}</span>
              <p className="text-lg font-bold text-violet-400">{formatEnergy(data.totalExportWh)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
