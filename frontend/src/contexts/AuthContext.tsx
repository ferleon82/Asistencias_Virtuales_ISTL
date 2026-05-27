import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../lib/axios';

// ─── Tipos ──────────────────────────────────────────────────────────────────────

export type Rol = 'docente' | 'coordinador' | 'tics' | 'rectorado' | 'talento_humano';

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'lastActivityAt';

function now(): number {
  return Date.now();
}

function updateLastActivity(): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(now()));
}

function isSessionExpired(): boolean {
  const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? 0);
  return !!lastActivity && now() - lastActivity >= INACTIVITY_TIMEOUT_MS;
}

// ─── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimerRef = useRef<number | null>(null);

  // Restaurar sesión al cargar la app
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      if (isSessionExpired()) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        setIsLoading(false);
        return;
      }

      api.get('/auth/me')
        .then(({ data }) => {
          updateLastActivity();
          setUser(data.data);
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem(LAST_ACTIVITY_KEY);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { user: authUser, tokens } = data.data;

    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    updateLastActivity();

    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return undefined;
    }

    const closeSession = () => {
      void logout();
    };

    const scheduleLogout = () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }

      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? now());
      const remaining = Math.max(INACTIVITY_TIMEOUT_MS - (now() - lastActivity), 0);
      inactivityTimerRef.current = window.setTimeout(closeSession, remaining);
    };

    const registerActivity = () => {
      updateLastActivity();
      scheduleLogout();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY) {
        scheduleLogout();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, { passive: true });
    });
    window.addEventListener('storage', handleStorage);

    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      updateLastActivity();
    }
    scheduleLogout();

    return () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, registerActivity);
      });
      window.removeEventListener('storage', handleStorage);
    };
  }, [logout, user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}
