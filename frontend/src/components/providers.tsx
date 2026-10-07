'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { api, tokenKey } from '@/lib/api';
import type { Session, User } from '@/lib/types';
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  login: (session: Session) => void;
  logout: () => void;
}
const AuthContext = createContext<AuthContextType | null>(null);
function subscribeToken(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('stayhub:token', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('stayhub:token', callback);
  };
}
const serverToken = () => undefined;
const readToken = () => localStorage.getItem(tokenKey);
function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const token = useSyncExternalStore(subscribeToken, readToken, serverToken);
  const ready = token !== undefined;
  const logout = useCallback(() => {
    localStorage.removeItem(tokenKey);
    window.dispatchEvent(new Event('stayhub:token'));
    queryClient.clear();
  }, [queryClient]);
  useEffect(() => {
    const sync = () => {
      queryClient.clear();
    };
    window.addEventListener('stayhub:logout', logout);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('stayhub:logout', logout);
      window.removeEventListener('storage', sync);
    };
  }, [logout, queryClient]);
  const me = useQuery({
    queryKey: ['me', token],
    queryFn: api.me,
    enabled: ready && !!token,
    retry: false,
    staleTime: 30000,
  });
  const login = (session: Session) => {
    queryClient.clear();
    localStorage.setItem(tokenKey, session.accessToken);
    queryClient.setQueryData(['me', session.accessToken], session.user);
    window.dispatchEvent(new Event('stayhub:token'));
  };
  return (
    <AuthContext.Provider
      value={{
        user: token ? (me.data ?? null) : null,
        loading: !ready || (!!token && me.isPending),
        error: me.error,
        retry: () => {
          void me.refetch();
        },
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        {children}
        <Toaster
          className="stayhub-toaster"
          richColors
          position="top-right"
          containerAriaLabel="Thông báo"
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider missing');
  return context;
}
