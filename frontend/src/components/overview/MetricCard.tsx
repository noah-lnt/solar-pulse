import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  color: string;
}

export function MetricCard({ title, value, subtitle, icon: Icon, color }: MetricCardProps) {
  return (
    <Card className="border-border bg-card/50">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-lg', color)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="truncate text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
