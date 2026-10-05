'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, session } from './api';
import type { Role, User, WorkspaceWithRole } from './types';

interface AuthContextValue {
  user: User | null;
  workspace: WorkspaceWithRole | null;
  loading: boolean;
  canManage: boolean;
  refresh: () => Promise<User | null>;
  selectWorkspace: (id: number) => void;
  logout: () => void;
}

interface SessionState {
  user: User | null;
  workspaceId: number | null;
}

const MANAGE_ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER'];

const AuthContext = createContext<AuthContextValue | null>(null);

/** Resolve the logged-in user and their active workspace from the stored token. */
async function loadSession(): Promise<SessionState> {
  if (!session.getToken()) return { user: null, workspaceId: null };
  try {
    const user = await getMe();
    const stored = session.getWorkspaceId();
    const selected = user.workspaces.find((w) => w.id === stored) ?? user.workspaces[0] ?? null;
    session.setWorkspaceId(selected?.id ?? null);
    return { user, workspaceId: selected?.id ?? null };
  } catch {
    session.clear();
    return { user: null, workspaceId: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ user: null, workspaceId: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadSession().then((next) => {
      if (!active) return;
      setState(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const refresh = useCallback(async () => {
    const next = await loadSession();
    setState(next);
    setLoading(false);
    return next.user;
  }, []);

  const selectWorkspace = useCallback((id: number) => {
    session.setWorkspaceId(id);
    setState((prev) => ({ ...prev, workspaceId: id }));
  }, []);

  const logout = useCallback(() => {
    session.clear();
    setState({ user: null, workspaceId: null });
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(() => {
    const workspace = state.user?.workspaces.find((w) => w.id === state.workspaceId) ?? null;
    return {
      user: state.user,
      workspace,
      loading,
      canManage: !!workspace && MANAGE_ROLES.includes(workspace.role),
      refresh,
      selectWorkspace,
      logout,
    };
  }, [state, loading, refresh, selectWorkspace, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
