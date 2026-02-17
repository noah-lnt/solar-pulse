import { PanelSummary } from '@/components/panels/PanelSummary';
import { PVProductionChart } from '@/components/panels/PVProductionChart';
import { Badge } from '@/components/ui/badge';
import type { SystemState, HistoryPoint } from '@/lib/types';

interface PanelsPageProps {
  state: SystemState | null;
  history: HistoryPoint[];
}

export function PanelsPage({ state, history }: PanelsPageProps) {
  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        En attente des donnees...
      </div>
    );
  }

  const statusColor = {
    producing: 'bg-emerald-500/20 text-emerald-400',
    idle: 'bg-zinc-500/20 text-zinc-400',
    offline: 'bg-red-500/20 text-red-400',
  }[state.pv.status];

  const statusLabel = {
    producing: 'En production',
    idle: 'Veille',
    offline: 'Hors ligne',
  }[state.pv.status];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Panneaux solaires</h2>
        <Badge className={statusColor}>{statusLabel}</Badge>
      </div>
      <PanelSummary data={state.pv} />
      <PVProductionChart history={history} />
    </div>
  );
}
