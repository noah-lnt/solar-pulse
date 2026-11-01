import { useState, useCallback, useEffect } from 'react';
import * as auth from '@/lib/auth';

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auth.checkAuth().then(setIsLoggedIn);
  }, []);

  const handleLogin = useCallback(async (email: string, password: string, remember: boolean) => {
    setLoading(true);
    setError(null);
    try {
      await auth.login(email, password, remember);
      setIsLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRegister = useCallback(async (email: string, password: string, secret: string) => {
    setLoading(true);
    setError(null);
    try {
      await auth.register(email, password, secret);
      setIsLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d\'inscription');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await auth.logout();
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
