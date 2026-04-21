import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'STUDENT';
  profile?: {
    instituteId: string;
    fullName: string;
    phone?: string;
    whatsappPhone?: string;
    school?: string;
    avatarUrl?: string;
    address?: string;
    dateOfBirth?: string;
    guardianName?: string;
    guardianPhone?: string;
    relationship?: string;
    occupation?: string;
    gender?: string;
    status?: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<User>;
  register: (data: Record<string, string | undefined>) => Promise<User>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);
const SESSION_HINT_KEY = 'authSessionHint';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          sessionStorage.removeItem('accessToken');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      const hasSessionHint = localStorage.getItem(SESSION_HINT_KEY) === '1';
      if (!hasSessionHint) {
        setLoading(false);
        return;
      }

      // Try a silent refresh — maybe we have a valid refresh token cookie
      api.post('/auth/refresh', {}, { timeout: 2000 })
        .then((res) => {
          sessionStorage.setItem('accessToken', res.data.accessToken);
          setToken(res.data.accessToken);
          setUser(res.data.user);
        })
        .catch(() => {
          // No valid session
          localStorage.removeItem(SESSION_HINT_KEY);
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await api.post('/auth/login', { identifier, password });
    sessionStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem(SESSION_HINT_KEY, '1');
    localStorage.removeItem('selectedInstituteId');
    setToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (data: Record<string, string | undefined>) => {
    const res = await api.post('/auth/register', data);
    sessionStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem(SESSION_HINT_KEY, '1');
    setToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem(SESSION_HINT_KEY);
    localStorage.removeItem('selectedInstituteId');
    setToken(null);
    setUser(null);
  };

  const refreshMe = async () => {
    const res = await api.get('/auth/me');
    setUser(res.data);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refreshMe, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
