import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { bindBackButton } from '../telegram/tg';

export type Tab = 'home' | 'workouts' | 'programs' | 'calendar' | 'stats' | 'profile';

export type Route =
  | { name: 'program'; id: string }
  | { name: 'day'; programId: string; blockId: string; dayId: string }
  | { name: 'import'; programId?: string }
  | { name: 'library' }
  | { name: 'run' }
  | { name: 'summary'; id: string }
  | { name: 'workout'; id: string }
  | { name: 'weights' }
  | { name: 'recommendations' };

interface Nav {
  tab: Tab;
  stack: Route[];
  setTab(t: Tab): void;
  push(r: Route): void;
  pop(): void;
  replace(r: Route): void;
  reset(): void;
}

const NavCtx = createContext<Nav | null>(null);

export function useNav(): Nav {
  const n = useContext(NavCtx);
  if (!n) throw new Error('NavProvider missing');
  return n;
}

const TAB_KEY = 'sportik.tab';

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>(() => {
    try { return (localStorage.getItem(TAB_KEY) as Tab) || 'home'; } catch { return 'home'; }
  });
  const [stack, setStack] = useState<Route[]>([]);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    setStack([]);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* per-viewer convenience only */ }
    window.scrollTo(0, 0);
  }, []);
  const push = useCallback((r: Route) => { setStack((s) => [...s, r]); window.scrollTo(0, 0); }, []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), []);
  const reset = useCallback(() => setStack([]), []);

  // Telegram native back button mirrors the in-app stack.
  useEffect(() => bindBackButton(stack.length ? pop : null), [stack.length, pop]);

  const value = useMemo(() => ({ tab, stack, setTab, push, pop, replace, reset }), [tab, stack, setTab, push, pop, replace, reset]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}
