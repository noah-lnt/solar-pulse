import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPower, formatVoltage, formatCurrent } from '@/lib/utils';
import type { ShellyPhase } from '@/lib/types';

interface PhaseCardProps {
  phase: ShellyPhase;
  label: string;
}

export function PhaseCard({ phase, label }: PhaseCardProps) {
  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Tension</span>
            <p className="font-medium">{formatVoltage(phase.voltage)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Courant</span>
            <p className="font-medium">{formatCurrent(phase.current)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Puissance</span>
            <p className={`font-medium ${phase.power > 0 ? 'text-red-400' : 'text-violet-400'}`}>
              {formatPower(phase.power)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Facteur puissance</span>
            <p className="font-medium">{phase.powerFactor.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Puissance app.</span>
            <p className="font-medium">{phase.apparentPower} VA</p>
          </div>
          <div>
            <span className="text-muted-foreground">Frequence</span>
            <p className="font-medium">{phase.frequency.toFixed(1)} Hz</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
