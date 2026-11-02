import { useEffect, useState } from 'react';

// Recharts draws inline SVG, where hsl(var(--x)) does not resolve: read the theme variables at runtime.
interface ChartTheme {
  grid: string;
  textMuted: string;
}

function resolveColor(varName: string): string {
  return `hsl(${getComputedStyle(document.documentElement).getPropertyValue(varName).trim()})`;
}

function buildTheme(): ChartTheme {
  return {
    grid: resolveColor('--border'),
    textMuted: resolveColor('--muted-foreground'),
  };
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(buildTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(buildTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
