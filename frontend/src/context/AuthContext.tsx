import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, api, authenticateTelegram, getToken, setToken } from '@/api/client';
import type { MeResponse } from '@/types';

interface AuthContextValue {
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  applyBalance: (balance: number) => void;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        let nextMe: MeResponse | null = null;
        if (getToken()) {
          try {
            nextMe = await api.me();
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
              setToken(null);
            } else {
              throw err;
            }
          }
        }
        const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (nextMe && telegramUser && nextMe.user.telegram_id !== telegramUser.id) {
          // A cached dev/other-account JWT must not leak into a Telegram session.
          setToken(null);
          nextMe = null;
        }
        if (!nextMe) {
          await authenticateTelegram();
          nextMe = await api.me();
        }
        if (!cancelled) setMe(nextMe);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 0) {
            setError('Сервер недоступен. Проверьте, что backend запущен.');
          } else {
            setError(err instanceof Error ? err.message : 'Не удалось авторизоваться');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const refresh = useCallback(async () => {
    const next = await api.me();
    setMe(next);
  }, []);

  const applyBalance = useCallback((balance: number) => {
    setMe((current) =>
      current
        ? { ...current, user: { ...current.user, balance } }
        : current,
    );
  }, []);

  const retry = useCallback(() => {
    setToken(null);
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({ me, loading, error, refresh, applyBalance, retry }),
    [me, loading, error, refresh, applyBalance, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
