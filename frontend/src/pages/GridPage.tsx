import { PhaseCard } from '@/components/grid/PhaseCard';
import { GridTotals } from '@/components/grid/GridTotals';
import { GridPowerChart } from '@/components/grid/GridPowerChart';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SystemState, HistoryPoint } from '@/lib/types';

interface GridPageProps {
  state: SystemState | null;
  history: HistoryPoint[];
}

export function GridPage({ state, history }: GridPageProps) {
  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        En attente des donnees...
      </div>
    );
  }

  const victronOn = state.victron.mode !== 'off';

  return (
    <div className="space-y-4">
      {victronOn && (
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertDescription className="text-amber-400">
            Victron actif — Le Shelly mesure les echanges avec le Victron, pas avec le reseau public.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <PhaseCard phase={state.grid.phases[0]} label="Phase L1" />
        <PhaseCard phase={state.grid.phases[1]} label="Phase L2" />
        <PhaseCard phase={state.grid.phases[2]} label="Phase L3" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GridTotals data={state.grid} victronOn={victronOn} />
        <GridPowerChart history={history} />
      </div>
    </div>
  );
}
