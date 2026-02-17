import { useState, useCallback } from 'react';
import * as auth from '@/lib/auth';

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(auth.isAuthenticated());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await auth.login(email, password);
      setIsLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRegister = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await auth.register(email, password);
      setIsLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d\'inscription');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    auth.logout();
    setIsLoggedIn(false);
  }, []);

  return {
    isLoggedIn,
    loading,
    error,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    clearError: () => setError(null),
  };
}
