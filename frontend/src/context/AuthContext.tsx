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
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (data: Record<string, string>) => Promise<User>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

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
      // Try a silent refresh — maybe we have a valid refresh token cookie
      api.post('/auth/refresh')
        .then((res) => {
          sessionStorage.setItem('accessToken', res.data.accessToken);
          setToken(res.data.accessToken);
          setUser(res.data.user);
        })
        .catch(() => {
          // No valid session
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    sessionStorage.setItem('accessToken', res.data.accessToken);
    setToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (data: Record<string, string>) => {
    const res = await api.post('/auth/register', data);
    sessionStorage.setItem('accessToken', res.data.accessToken);
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
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
