import { useState } from 'react';
import { Header } from './Header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSystemState } from '@/hooks/useSystemState';
import { useTheme } from '@/hooks/useTheme';
import { OverviewPage } from '@/pages/OverviewPage';
import { BatteriesPage } from '@/pages/BatteriesPage';
import { GridPage } from '@/pages/GridPage';
import { PanelsPage } from '@/pages/PanelsPage';

interface DashboardShellProps {
  onLogout: () => void;
}

export function DashboardShell({ onLogout }: DashboardShellProps) {
  const [tab, setTab] = useState('overview');
  const { status: wsStatus, lastState } = useWebSocket();
  const { state, history } = useSystemState(lastState);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header wsStatus={wsStatus} onLogout={onLogout} theme={theme} onToggleTheme={toggleTheme} />
      <main className="flex-1 p-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="batteries">Batteries</TabsTrigger>
            <TabsTrigger value="grid">Reseau</TabsTrigger>
            <TabsTrigger value="panels">Panneaux</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <OverviewPage state={state} history={history} />
          </TabsContent>
          <TabsContent value="batteries">
            <BatteriesPage state={state} />
          </TabsContent>
          <TabsContent value="grid">
            <GridPage state={state} history={history} />
          </TabsContent>
          <TabsContent value="panels">
            <PanelsPage state={state} history={history} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
