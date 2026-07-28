import { useCallback, useEffect, useState } from 'react';
import { getStoredKey, setStoredKey, clearStoredKey, checkPassword } from '@/lib/api';

export function useAuth() {
  const [authed, setAuthed] = useState(() => Boolean(getStoredKey()));

  useEffect(() => {
    const onUnauthorized = () => setAuthed(false);
    window.addEventListener('dashboard:unauthorized', onUnauthorized);
    return () => window.removeEventListener('dashboard:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (password) => {
    const ok = await checkPassword(password);
    if (ok) {
      setStoredKey(password);
      setAuthed(true);
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    clearStoredKey();
    setAuthed(false);
  }, []);

  return { authed, login, logout };
}
