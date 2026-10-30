'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, ArrowUpDown, PiggyBank, Landmark, Target, CalendarDays } from 'lucide-react';
import { useApp, useLoad } from '@/components/app-provider';
import { DateFilter, initFilter, filterLabel, type FilterState } from '@/components/date-filter';
import { Bars, Lines, Pie1 } from '@/components/charts';
import { Badge, Card, CardBody, CardHeader, Empty, Loading, PageHeader, Progress, Skeleton, Stat } from '@/components/ui';
import { addDays, addMonths, dayOf, eachDay, fmtDate, fmtDay, startOfMonth, todayStr } from '@/lib/dates';
import { fetchTxns, goalProgress, loadBudgets } from '@/lib/queries';
import { summarize, isExpense } from '@/lib/calc';
import type { Debt, Goal, Occurrence, Rule } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { sb, tz, money, accounts, categories, balances, hide } = useApp();
  const [filter, setFilter] = useState<FilterState>(initFilter(tz, 'month'));
  const today = todayStr(tz);
  const { data: d, loading, error } = useLoad(async () => {
    const since = [filter.from, addMonths(startOfMonth(today), -5)].sort()[0];
    const [txns, budgets, gp, goals, debts, occ, rules] = await Promise.all([
      fetchTxns(sb, tz, since), loadBudgets(sb, tz, today), goalProgress(sb),
      sb.from('savings_goals').select('*').eq('status', 'active').order('target_date', { nullsFirst: false }),
      sb.from('debts').select('*').eq('status', 'active').eq('direction', 'payable'),
      sb.from('recurring_occurrences').select('*').eq('state', 'pending').lte('due_date', addDays(today, 14)).order('due_date'),
      sb.from('recurring_rules').select('*'),
    ]);
    return { txns, budgets, gp, goals: (goals.data ?? []) as Goal[], debts: (debts.data ?? []) as Debt[], occ: (occ.data ?? []) as Occurrence[], rules: (rules.data ?? []) as Rule[] };
  }, [filter.from, filter.to]);

  if (error) return <Empty title="Could not load dashboard" hint={error} />;
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';
  const spendIds = new Set(accounts.filter((a) => !a.archived_at && a.type !== 'savings').map((a) => a.id));
  const available = [...spendIds].reduce((s, id) => s + (balances[id] ?? 0), 0);
  const savingsBal = accounts.filter((a) => !a.archived_at && a.type === 'savings').reduce((s, a) => s + (balances[a.id] ?? 0), 0);
  const blur = hide ? 'blur-sm select-none' : '';

  let body: React.ReactNode = <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (d) {
    const inRange = d.txns.filter((t) => { const x = dayOf(t.occurred_at, tz); return x >= filter.from && x <= filter.to; });
    const s = summarize(inRange, catName, tz);
    const todaySpend = d.txns.filter((t) => isExpense(t.kind) && dayOf(t.occurred_at, tz) === today).reduce((a, t) => a + t.amount_minor, 0);
    const outstanding = d.debts.reduce((a, x) => a + x.outstanding_minor, 0);
    const monthly = d.budgets.filter((b) => b.period === 'monthly' && !b.category_id);
    const mAmt = monthly.reduce((a, b) => a + b.amount_minor, 0), mSpent = monthly.reduce((a, b) => a + b.spent, 0);
    const days = eachDay(filter.from, filter.to);
    const byMonth = days.length > 62;
    const bucket = (day: string) => (byMonth ? day.slice(0, 7) : day);
    const map = new Map<string, { income: number; expense: number }>();
    for (const x of s.byDay) { const k = bucket(x.date); const v = map.get(k) ?? { income: 0, expense: 0 }; v.income += x.income; v.expense += x.expense; map.set(k, v); }
    const flow = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ label: byMonth ? fmtDay(k + '-01', 'MMM yy') : fmtDay(k, 'd MMM'), Income: money.major(v.income), Expenses: money.major(v.expense) }));
    const daily = s.byDay.filter((x) => x.expense > 0).map((x) => ({ label: fmtDay(x.date, 'd MMM'), Spending: money.major(x.expense) }));
    const m6 = Array.from({ length: 6 }, (_, i) => addMonths(startOfMonth(today), i - 5));
    const cash = m6.map((m) => { const k = m.slice(0, 7); const sm = summarize(d.txns.filter((t) => dayOf(t.occurred_at, tz).startsWith(k)), catName, tz); return { label: fmtDay(m, 'MMM'), 'Net cash flow': money.major(sm.net) }; });
    const spendTx = d.txns.filter((t) => spendIds.has(t.account_id));
    const hist = days.filter((x) => x <= today).filter((_, i, a) => a.length <= 90 || i % Math.ceil(a.length / 90) === 0 || i === a.length - 1).map((day) => ({
      label: fmtDay(day, 'd MMM'), Balance: money.major(available - spendTx.filter((t) => dayOf(t.occurred_at, tz) > day).reduce((a, t) => a + t.signed_amount_minor, 0)),
    }));
    const rm = new Map(d.rules.map((r) => [r.id, r]));
    const upcoming = d.occ.map((o) => ({ o, r: rm.get(o.rule_id)! })).filter((x) => x.r);
    body = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Available balance" value={<span className={blur}>{money.fmt(available)}</span>} sub="Spending accounts" icon={<Wallet className="h-4 w-4" />} />
          <Stat label={`Income · ${filterLabel(filter)}`} value={<span className={blur}>{money.fmt(s.income)}</span>} tone="success" icon={<TrendingUp className="h-4 w-4" />} />
          <Stat label={`Expenses · ${filterLabel(filter)}`} value={<span className={blur}>{money.fmt(s.expense)}</span>} tone="danger" icon={<TrendingDown className="h-4 w-4" />} />
          <Stat label="Net cash flow" value={<span className={blur}>{money.fmt(s.net)}</span>} tone={s.net >= 0 ? 'success' : 'danger'} sub={s.savingsRate === null ? 'Savings rate: n/a (no income)' : `Savings rate ${s.savingsRate.toFixed(1)}%`} icon={<ArrowUpDown className="h-4 w-4" />} />
          <Stat label="Total savings" value={<span className={blur}>{money.fmt(savingsBal)}</span>} sub="Savings accounts" icon={<PiggyBank className="h-4 w-4" />} />
          <Stat label="Outstanding debt" value={<span className={blur}>{money.fmt(outstanding)}</span>} sub={`${d.debts.length} active`} icon={<Landmark className="h-4 w-4" />} />
          <Stat label="Monthly budget left" value={monthly.length ? <span className={blur}>{money.fmt(mAmt - mSpent)}</span> : '—'} tone={monthly.length && mAmt - mSpent < 0 ? 'danger' : undefined} sub={monthly.length ? `${money.fmt(mSpent)} of ${money.fmt(mAmt)} used` : 'No monthly budget set'} icon={<Target className="h-4 w-4" />} />
          <Stat label="Today's spending" value={<span className={blur}>{money.fmt(todaySpend)}</span>} sub={<Link href="/daily" className="underline">Daily tracker</Link>} icon={<CalendarDays className="h-4 w-4" />} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card><CardHeader title="Income vs expenses" /><CardBody><Bars data={flow} series={[{ key: 'Income', color: '#10b981' }, { key: 'Expenses', color: '#ef4444' }]} /></CardBody></Card>
          <Card><CardHeader title="Daily spending" /><CardBody><Bars data={daily} series={[{ key: 'Spending', color: '#f59e0b' }]} /></CardBody></Card>
          <Card><CardHeader title="Monthly cash flow (6 months)" /><CardBody><Bars data={cash} series={[{ key: 'Net cash flow', color: '#3b82f6' }]} /></CardBody></Card>
          <Card><CardHeader title="Expense breakdown" /><CardBody><Pie1 data={s.byCat.slice(0, 8).map((x) => ({ name: x.name, value: money.major(x.value) }))} /></CardBody></Card>
          <Card><CardHeader title="Balance history" /><CardBody><Lines data={hist} series={[{ key: 'Balance', color: '#10b981' }]} /></CardBody></Card>
          <Card><CardHeader title="Budget utilisation" action={<Link href="/budgets" className="text-xs underline">Manage</Link>} />
            <CardBody className="space-y-3">{d.budgets.length ? d.budgets.slice(0, 5).map((b) => (
              <div key={b.id}><div className="mb-1 flex justify-between text-sm"><span>{b.name}</span><Badge tone={b.status === 'Exceeded' ? 'danger' : b.status === 'On Track' ? 'success' : 'warning'}>{b.status}</Badge></div><Progress value={b.pct} tone={b.pct >= 100 ? 'danger' : b.pct >= 75 ? 'warning' : 'success'} /><div className="num mt-1 text-xs text-muted-foreground">{money.fmt(b.spent)} / {money.fmt(b.amount_minor)} ({b.pct.toFixed(0)}%)</div></div>
            )) : <Empty title="No active budgets" hint="Create a budget to track spending limits." />}</CardBody></Card>
          <Card><CardHeader title="Savings progress" action={<Link href="/savings" className="text-xs underline">All goals</Link>} />
            <CardBody className="space-y-3">{d.goals.length ? d.goals.slice(0, 4).map((g) => { const cur = d.gp[g.id] ?? 0; const p = (cur / g.target_minor) * 100; return (
              <div key={g.id}><div className="mb-1 flex justify-between text-sm"><span>{g.name}</span><span className="num text-muted-foreground">{p.toFixed(0)}%</span></div><Progress value={p} /><div className="num mt-1 text-xs text-muted-foreground">{money.fmt(cur)} of {money.fmt(g.target_minor)}{g.target_date ? ` · by ${fmtDay(g.target_date, 'd MMM yyyy')}` : ''}</div></div>); }) : <Empty title="No active goals" hint="Set a savings goal to start tracking progress." />}</CardBody></Card>
          <Card><CardHeader title="Upcoming bills & expected income" action={<Link href="/bills" className="text-xs underline">Bills</Link>} />
            <CardBody>{upcoming.length ? <ul className="divide-y divide-border">{upcoming.slice(0, 6).map(({ o, r }) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm"><div><div className="font-medium">{r.name}</div><div className={cn('text-xs', o.due_date < today ? 'text-destructive' : 'text-muted-foreground')}>{o.due_date < today ? 'Overdue · ' : ''}{fmtDay(o.due_date)}</div></div><span className={cn('num', r.kind === 'income' && 'text-success')}>{r.kind === 'income' ? '+' : ''}{money.fmt(r.amount_minor)}</span></li>))}</ul> : <Empty title="Nothing due in the next 14 days" />}</CardBody></Card>
          <Card><CardHeader title="Recent transactions" action={<Link href="/transactions" className="text-xs underline">View all</Link>} />
            <CardBody>{inRange.length ? <ul className="divide-y divide-border">{inRange.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm"><div className="min-w-0"><div className="truncate font-medium">{t.description || t.counterparty || catName(t.category_id)}</div><div className="text-xs text-muted-foreground">{fmtDate(t.occurred_at, tz, 'd MMM, HH:mm')}</div></div><span className={cn('num shrink-0', ['income', 'deposit', 'transfer_in', 'debt_collection'].includes(t.kind) ? 'text-success' : '', blur)}>{['income', 'deposit', 'transfer_in', 'debt_collection'].includes(t.kind) ? '+' : '−'}{money.fmt(t.amount_minor)}</span></li>))}</ul> : <Empty title="No transactions in this period" hint="Use the + button to add your first transaction." />}</CardBody></Card>
        </div>
      </>
    );
  } else if (!loading) body = <Loading />;
  return <><PageHeader title="Dashboard" desc="Your financial position at a glance." /><div className="mb-4"><DateFilter value={filter} onChange={setFilter} tz={tz} /></div>{body}</>;
}
