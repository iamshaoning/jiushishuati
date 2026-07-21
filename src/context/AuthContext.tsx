import { createContext, useContext, useState, type ReactNode } from 'react';
import { getCurrentUser, logout as doLogout, type SessionUser } from '@/lib/auth';

interface AuthCtx {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  setUser: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // 惰性初始化：首次渲染即从 localStorage 读取，避免 RequireAuth 在 useEffect 执行前误判未登录而跳转登录页
  const [user, setUser] = useState<SessionUser | null>(() => getCurrentUser());

  const logout = () => {
    doLogout();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, setUser, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
