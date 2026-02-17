import { useEffect, useState } from 'react';
import { Sun, Moon, LogOut, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  wsStatus: 'connected' | 'reconnecting' | 'disconnected';
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Header({ wsStatus, onLogout, theme, onToggleTheme }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = time.toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <Sun className="h-6 w-6 text-amber-500" />
        <span className="text-lg font-bold">SolarPulse</span>
        {wsStatus === 'connected' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <span className="h-2 w-2 animate-pulse_live rounded-full bg-emerald-500" />
            LIVE
          </span>
        )}
        {wsStatus === 'reconnecting' && (
          <span className="flex items-center gap-1.5 text-xs text-amber-500">
            <Wifi className="h-3 w-3" />
            Reconnexion...
          </span>
        )}
        {wsStatus === 'disconnected' && (
          <span className="flex items-center gap-1.5 text-xs text-red-500">
            <WifiOff className="h-3 w-3" />
            Deconnecte
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-muted-foreground">{formattedTime}</span>
        <Button variant="ghost" size="icon" onClick={onToggleTheme} title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onLogout} title="Deconnexion">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
