import { BatteryGauge } from '@/components/batteries/BatteryGauge';
import { CellVoltagesGrid } from '@/components/batteries/CellVoltagesGrid';
import { VictronStatus } from '@/components/batteries/VictronStatus';
import type { SystemState } from '@/lib/types';

interface BatteriesPageProps {
  state: SystemState | null;
}

export function BatteriesPage({ state }: BatteriesPageProps) {
  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        En attente des donnees...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BatteryGauge title="LiFePO4 DIY" data={state.lifepoDiy} color="text-purple-400" showDetails={true} />

      <div className="grid gap-4 md:grid-cols-2">
        <CellVoltagesGrid data={state.lifepoDiy} />
        <VictronStatus data={state.victron} />
      </div>
    </div>
  );
}
