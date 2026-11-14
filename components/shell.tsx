'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Home, ReceiptText, Target, Wallet, BarChart3, Bell, Settings, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Moon, Sun, X, Wallet2 } from 'lucide-react';
import { useApp } from './app-provider';
import { QuickAddProvider } from './quick-add';
import { Button } from './ui';
import { cn } from '@/lib/utils';
import { syncNotifications } from '@/lib/notify';

type Tab = { href: string; label: string };
type Group = { label: string; href: string; icon: typeof Home; match: string[]; tabs?: Tab[] };
// Five main sections instead of fifteen menu items. Related pages are tabs inside their section.
const GROUPS: Group[] = [
  { label: 'Home', href: '/dashboard', icon: Home, match: ['/dashboard'] },
  { label: 'Activity', href: '/transactions', icon: ReceiptText, match: ['/transactions', '/daily', '/income', '/expenses'],
    tabs: [{ href: '/transactions', label: 'All' }, { href: '/daily', label: 'Daily' }, { href: '/income', label: 'Income' }, { href: '/expenses', label: 'Expenses' }] },
  { label: 'Accounts', href: '/accounts', icon: Wallet, match: ['/accounts'] },
  { label: 'Plan', href: '/budgets', icon: Target, match: ['/budgets', '/savings', '/debts', '/bills'],
    tabs: [{ href: '/budgets', label: 'Budgets' }, { href: '/savings', label: 'Savings' }, { href: '/debts', label: 'Debts' }, { href: '/bills', label: 'Bills' }] },
  { label: 'Reports', href: '/reports', icon: BarChart3, match: ['/reports', '/insights', '/calendar'],
    tabs: [{ href: '/reports', label: 'Reports' }, { href: '/insights', label: 'Insights' }, { href: '/calendar', label: 'Calendar' }] },
];
const EXTRA = [{ href: '/notifications', label: 'Notifications', icon: Bell }, { href: '/settings', label: 'Settings', icon: Settings }];
const MOBILE = ['Home', 'Activity', 'Accounts', 'Plan'];
const inGroup = (path: string, g: Group) => g.match.some((m) => path === m || path.startsWith(m + '/'));

function SectionTabs({ path }: { path: string }) {
  const g = GROUPS.find((x) => x.tabs && inGroup(path, x)); if (!g?.tabs) return null;
  return (
    <nav aria-label={`${g.label} sections`} className="no-print -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {g.tabs.map((t) => { const a = path === t.href || path.startsWith(t.href + '/'); return (
        <Link key={t.href} href={t.href} aria-current={a ? 'page' : undefined}
          className={cn('inline-flex min-h-[40px] shrink-0 items-center rounded-full px-4 text-sm font-medium', a ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>{t.label}</Link>); })}
    </nav>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { sb, profile, unread, tick, accounts, refresh, reloadProfile } = useApp();
  const path = usePathname(); const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const last = useRef(0);
  useEffect(() => { setDrawer(false); }, [path]);
  useEffect(() => { setCollapsed(localStorage.getItem('sidebar') === '1'); }, []);
  useEffect(() => {
    if (Date.now() - last.current < 60000) return; last.current = Date.now();
    syncNotifications(sb, profile, accounts).then(() => reloadProfile()).catch(() => {});
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  async function logout() { await sb.auth.signOut(); router.replace('/login'); router.refresh(); }
  async function theme() {
    const dark = document.documentElement.classList.contains('dark'); const next = dark ? 'light' : 'dark';
    await sb.from('profiles').update({ theme: next }).eq('id', profile.id); refresh();
  }
  const link = (n: { href: string; label: string; icon: typeof Home }, active: boolean, compact: boolean) => (
    <Link key={n.href} href={n.href} title={n.label} aria-current={active ? 'page' : undefined}
      className={cn('flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium', active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground', compact && 'justify-center px-2')}>
      <span className="relative"><n.icon className="h-5 w-5" />{n.href === '/notifications' && unread > 0 && <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-destructive" />}</span>
      {!compact && <span>{n.label}</span>}
    </Link>
  );
  const moreActive = !GROUPS.filter((g) => MOBILE.includes(g.label)).some((g) => inGroup(path, g));
  return (
    <QuickAddProvider>
      <div className="min-h-screen md:flex">
        <aside className={cn('no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card p-3 md:flex', collapsed ? 'w-16' : 'w-60')}>
          <div className={cn('mb-4 flex items-center gap-2 px-2 py-2', collapsed && 'justify-center')}><Wallet2 className="h-5 w-5 text-primary" />{!collapsed && <span className="font-semibold">Money Manager Pro</span>}</div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Main">{GROUPS.map((g) => link(g, inGroup(path, g), collapsed))}<div className="my-3 border-t border-border" />{EXTRA.map((n) => link(n, path.startsWith(n.href), collapsed))}</nav>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setCollapsed(!collapsed); localStorage.setItem('sidebar', collapsed ? '0' : '1'); }} aria-label="Toggle sidebar">{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}</Button>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/90 px-4 backdrop-blur">
            <div className="flex items-center gap-2 md:hidden"><Wallet2 className="h-5 w-5 text-primary" /><span className="font-semibold">Money Manager</span></div>
            <div className="hidden text-sm text-muted-foreground md:block">{profile.full_name ? `Hello, ${profile.full_name.split(' ')[0]}` : 'Welcome'}</div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={theme} aria-label="Toggle theme"><Sun className="hidden h-4 w-4 dark:block" /><Moon className="h-4 w-4 dark:hidden" /></Button>
              <Link href="/notifications" className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Bell className="h-4 w-4" />{unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white">{unread > 99 ? '99+' : unread}</span>}</Link>
              <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out"><LogOut className="h-4 w-4" /></Button>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-5 pb-28 md:pb-10"><SectionTabs path={path} />{children}</main>
        </div>
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card md:hidden" aria-label="Mobile">
          {GROUPS.filter((g) => MOBILE.includes(g.label)).map((g) => { const a = inGroup(path, g); return (
            <Link key={g.href} href={g.href} aria-current={a ? 'page' : undefined} className={cn('flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', a ? 'text-primary' : 'text-muted-foreground')}><g.icon className="h-6 w-6" />{g.label}</Link>); })}
          <button onClick={() => setDrawer(true)} aria-label="More" className={cn('flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', moreActive ? 'text-primary' : 'text-muted-foreground')}><Menu className="h-6 w-6" />More</button>
        </nav>
        {drawer && (
          <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setDrawer(false)}>
            <div className="absolute inset-y-0 right-0 w-72 overflow-y-auto bg-card p-3" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex justify-end"><Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-4 w-4" /></Button></div>
              {GROUPS.filter((g) => !MOBILE.includes(g.label)).map((g) => link(g, inGroup(path, g), false))}
              {EXTRA.map((n) => link(n, path.startsWith(n.href), false))}
            </div>
          </div>
        )}
      </div>
    </QuickAddProvider>
  );
}
