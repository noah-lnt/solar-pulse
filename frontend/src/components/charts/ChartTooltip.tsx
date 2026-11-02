import type { ReactNode } from 'react';

export interface TooltipRow {
  label: string;
  value: string;
  color: string;
}

export function ChartTooltip({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-muted-foreground">{title}</p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 text-card-foreground">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: row.color }} />
          <span>{row.label}</span>
          <span className="ml-auto font-semibold tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
