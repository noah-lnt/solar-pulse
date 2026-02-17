import { Sun, Zap } from 'lucide-react';
import { MetricCard } from '@/components/overview/MetricCard';
import { formatPower } from '@/lib/utils';
import type { HoymilesData } from '@/lib/types';

interface PanelSummaryProps {
  data: HoymilesData;
}

export function PanelSummary({ data }: PanelSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MetricCard
        title="Puissance totale"
        value={formatPower(data.powerNow)}
        icon={Zap}
        color="bg-amber-500/10 text-amber-500"
      />
      <MetricCard
        title="Production du jour"
        value={`${data.todayYield.toFixed(2)} kWh`}
        icon={Sun}
        color="bg-yellow-500/10 text-yellow-500"
      />
    </div>
  );
}
