'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { flush } from '@/lib/offline';
import { formatMoney, parseMinor, toMajor } from '@/lib/money';
import type { Account, Category, Profile } from '@/lib/types';

export type Money = { cur: string; fmt: (m: number) => string; fmtC: (m: number) => string; major: (m: number) => number; fmtMajor: (v: number) => string; parse: (s: string) => number | null };
type Ctx = {
  sb: SupabaseClient; user: User; profile: Profile; accounts: Account[]; categories: Category[]; balances: Record<string, number>;
  unread: number; tick: number; money: Money; tz: string; hide: boolean; refresh: () => void; reloadProfile: () => void;
};
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const sb = useMemo(() => createClient(), []);
  const [s, setS] = useState<{ user: User; profile: Profile; accounts: Account[]; categories: Category[]; balances: Record<string, number>; unread: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      const [p, a, c, b, n] = await Promise.all([
        sb.from('profiles').select('*').eq('id', user.id).single(),
        sb.from('accounts').select('*').order('created_at'),
        sb.from('categories').select('*').order('name'),
        sb.from('account_balances').select('account_id, balance_minor'),
        sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
      ]);
      if (p.error) throw p.error;
      setS({ user, profile: p.data as Profile, accounts: (a.data ?? []) as Account[], categories: (c.data ?? []) as Category[],
        balances: Object.fromEntries((b.data ?? []).map((r) => [r.account_id, Number(r.balance_minor)])), unread: n.count ?? 0 });
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to load'); }
  }, [sb]);
  useEffect(() => { load(); }, [load]);
  const refresh = useCallback(() => { load(); setTick((t) => t + 1); }, [load]);

  useEffect(() => {
    if (!s) return;
    const t = s.profile.theme; localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches));
  }, [s?.profile.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = !!s;
  useEffect(() => {
    if (!ready) return;
    const run = async () => {
      if (!navigator.onLine) return;
      const r = await flush(sb);
      if (r.saved) { toast.success(`Synced ${r.saved} ${r.saved === 1 ? 'entry' : 'entries'} saved while offline`); refresh(); }
      if (r.dropped) toast.error(`${r.dropped} offline ${r.dropped === 1 ? 'entry was' : 'entries were'} rejected by the server and not saved`);
    };
    run(); window.addEventListener('online', run); return () => window.removeEventListener('online', run);
  }, [ready, sb, refresh]);

  const cur = s?.profile.currency ?? 'KES';
  const money = useMemo<Money>(() => ({
    cur, fmt: (m) => formatMoney(m, cur), fmtC: (m) => formatMoney(m, cur, true), major: (m) => toMajor(m, cur),
    fmtMajor: (v) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: cur }).format(v), parse: (x) => parseMinor(x, cur),
  }), [cur]);

  if (err) return <div className="p-8 text-center"><p className="font-medium text-destructive">{err}</p><button className="mt-3 underline" onClick={() => location.reload()}>Retry</button></div>;
  if (!s) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading your workspace…</div>;
  const value: Ctx = { sb, ...s, tick, money, tz: s.profile.timezone, hide: !!s.profile.privacy?.hide_balances, refresh, reloadProfile: load };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const { tick } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true; setLoading(true);
    fn().then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e) => live && setError(e?.message ?? 'Failed to load'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [tick, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, loading, error };
}
