import { useAuth } from '@/hooks/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardShell } from '@/components/layout/DashboardShell';

export function App() {
  const { isLoggedIn, loading, error, login, register, logout } = useAuth();

  if (isLoggedIn === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        onLogin={login}
        onRegister={register}
        loading={loading}
        error={error}
      />
    );
  }

  return <DashboardShell onLogout={logout} />;
}
