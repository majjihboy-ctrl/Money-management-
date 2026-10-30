'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, CalendarDays, ReceiptText, ArrowDownLeft, ArrowUpRight, Target, Wallet, PiggyBank, Landmark, Repeat, BarChart3, Lightbulb, CalendarRange, Bell, Settings, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Moon, Sun, X, Wallet2 } from 'lucide-react';
import { useApp } from './app-provider';
import { QuickAddProvider } from './quick-add';
import { Button } from './ui';
import { cn } from '@/lib/utils';
import { syncNotifications } from '@/lib/notify';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { href: '/daily', label: 'Daily Spending', icon: CalendarDays },
  { href: '/transactions', label: 'Transactions', icon: ReceiptText }, { href: '/income', label: 'Income', icon: ArrowDownLeft },
  { href: '/expenses', label: 'Expenses', icon: ArrowUpRight }, { href: '/budgets', label: 'Budgets', icon: Target },
  { href: '/accounts', label: 'Accounts', icon: Wallet }, { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/debts', label: 'Debts', icon: Landmark }, { href: '/bills', label: 'Bills & Recurring', icon: Repeat },
  { href: '/reports', label: 'Reports', icon: BarChart3 }, { href: '/insights', label: 'Insights', icon: Lightbulb },
  { href: '/calendar', label: 'Calendar', icon: CalendarRange }, { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];
const MOBILE = ['/dashboard', '/daily', '/transactions', '/budgets'];

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
  const link = (n: (typeof NAV)[number], compact: boolean) => {
    const active = path === n.href || path.startsWith(n.href + '/');
    return (
      <Link key={n.href} href={n.href} title={n.label} aria-current={active ? 'page' : undefined}
        className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium', active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground', compact && 'justify-center px-2')}>
        <span className="relative"><n.icon className="h-4 w-4" />{n.href === '/notifications' && unread > 0 && <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-destructive" />}</span>
        {!compact && <span>{n.label}</span>}
      </Link>
    );
  };
  return (
    <QuickAddProvider>
      <div className="min-h-screen md:flex">
        <aside className={cn('no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card p-3 md:flex', collapsed ? 'w-16' : 'w-60')}>
          <div className={cn('mb-4 flex items-center gap-2 px-2 py-2', collapsed && 'justify-center')}><Wallet2 className="h-5 w-5 text-primary" />{!collapsed && <span className="font-semibold">Money Manager Pro</span>}</div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Main">{NAV.map((n) => link(n, collapsed))}</nav>
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
          <main className="mx-auto max-w-6xl px-4 py-5 pb-28 md:pb-10">{children}</main>
        </div>
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card md:hidden" aria-label="Mobile">
          {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => { const a = path.startsWith(n.href); return (
            <Link key={n.href} href={n.href} className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]', a ? 'text-primary' : 'text-muted-foreground')}><n.icon className="h-5 w-5" />{n.label.split(' ')[0]}</Link>); })}
          <button onClick={() => setDrawer(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground"><Menu className="h-5 w-5" />More</button>
        </nav>
        {drawer && (
          <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setDrawer(false)}>
            <div className="absolute inset-y-0 right-0 w-72 overflow-y-auto bg-card p-3" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex justify-end"><Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-4 w-4" /></Button></div>
              {NAV.map((n) => link(n, false))}
            </div>
          </div>
        )}
      </div>
    </QuickAddProvider>
  );
}
