'use client';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ChevronDown, CheckCircle2, Circle, AlertTriangle, Eye, EyeOff, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp, useLoad } from '@/components/app-provider';
import { useQuickAdd } from '@/components/quick-add';
import { MpesaImportButton } from '@/components/mpesa-import';
import { DateFilter, initFilter, type FilterState } from '@/components/date-filter';
import { Bars, Lines, Pie1 } from '@/components/charts';
import { CatAvatar } from '@/components/cat-avatar';
import { Badge, Card, CardBody, CardHeader, Empty, Ring, Skeleton } from '@/components/ui';
import { addDays, addMonths, daysBetween, dayOf, eachDay, endOfMonth, fmtDate, fmtDay, startOfMonth, todayStr } from '@/lib/dates';
import { fetchTxns, loadBudgets } from '@/lib/queries';
import { isExpense, pctChange, summarize } from '@/lib/calc';
import type { Occurrence, Rule } from '@/lib/types';
import { cn, errMsg } from '@/lib/utils';

const IN = ['income', 'deposit', 'transfer_in', 'debt_collection'];

export default function Home() {
  const { sb, tz, money, accounts, categories, balances, hide, profile, refresh } = useApp();
  const qa = useQuickAdd();
  const [filter, setFilter] = useState<FilterState>(initFilter(tz, 'month'));
  const [details, setDetails] = useState(false);
  const today = todayStr(tz); const monthFrom = startOfMonth(today);
  const { data: d, loading, error } = useLoad(async () => {
    const since = [filter.from, addMonths(monthFrom, -1)].sort()[0]; // this month + last month is all Home needs
    const [txns, budgets, occ, rules] = await Promise.all([
      fetchTxns(sb, tz, since), loadBudgets(sb, tz, today),
      sb.from('recurring_occurrences').select('*').eq('state', 'pending').lte('due_date', addDays(today, 7)).order('due_date'),
      sb.from('recurring_rules').select('*'),
    ]);
    return { txns, budgets, occ: (occ.data ?? []) as Occurrence[], rules: (rules.data ?? []) as Rule[] };
  }, [filter.from, filter.to]);

  const blur = hide ? 'blur-sm select-none' : '';
  const live = accounts.filter((a) => !a.archived_at).sort((a, b) => Number(b.type === 'mobile_money') - Number(a.type === 'mobile_money'));
  const spendIds = new Set(live.filter((a) => a.type !== 'savings').map((a) => a.id));
  const available = [...spendIds].reduce((s, id) => s + (balances[id] ?? 0), 0);
  const mpesa = live.find((a) => a.type === 'mobile_money');
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';
  async function toggleHide() {
    const { error: e } = await sb.from('profiles').update({ privacy: { ...profile.privacy, hide_balances: !hide } }).eq('id', profile.id);
    if (e) return void toast.error(errMsg(e)); refresh();
  }
  const first = profile.full_name ? profile.full_name.split(' ')[0] : null;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (error) return <Empty title="Could not load your home screen" hint={error} />;
  const month = d ? summarize(d.txns.filter((t) => dayOf(t.occurred_at, tz) >= monthFrom), catName, tz) : null;
  const monthly = d ? d.budgets.filter((b) => b.period === 'monthly' && !b.category_id) : [];
  const mAmt = monthly.reduce((a, b) => a + b.amount_minor, 0), mSpent = monthly.reduce((a, b) => a + b.spent, 0);
  // Same-period comparison: spending so far this month vs the same days last month.
  const prevFrom = addMonths(monthFrom, -1);
  const prevTo = [addDays(prevFrom, Number(today.slice(8)) - 1), endOfMonth(prevFrom)].sort()[0];
  const prevSpent = d ? d.txns.filter((t) => { const x = dayOf(t.occurred_at, tz); return isExpense(t.kind) && x >= prevFrom && x <= prevTo; }).reduce((a, t) => a + t.amount_minor, 0) : 0;
  const change = month ? pctChange(month.expense, prevSpent) : null;
  const topCat = month?.byCat[0];
  const daysLeft = daysBetween(today, endOfMonth(today)) + 1;
  const bPct = mAmt > 0 ? (mSpent / mAmt) * 100 : 0;
  const bTone = bPct >= 100 ? 'danger' : bPct >= 75 ? 'warning' : 'success';
  const rm = new Map((d?.rules ?? []).map((r) => [r.id, r]));
  const due = (d?.occ ?? []).map((o) => ({ o, r: rm.get(o.rule_id)! })).filter((x) => x.r);
  const budgetAlerts = (d?.budgets ?? []).filter((b) => b.pct >= 90);
  const needs = due.length + budgetAlerts.length;
  const steps = d ? [
    { done: !!mpesa, label: 'Add your M-Pesa account', hint: 'Accounts → New account → M-Pesa', href: '/accounts' },
    { done: d.txns.length > 0, label: 'Add your first transactions', hint: 'Paste your M-Pesa messages, or tap Expense / Income', href: mpesa ? `/accounts/${mpesa.id}` : '/accounts' },
    { done: monthly.length > 0, label: 'Set a monthly budget', hint: 'See how much you can still spend', href: '/budgets' },
  ] : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{greeting}{first ? `, ${first}` : ''}</h1>
        <p className="text-sm text-muted-foreground">{fmtDay(today, 'EEEE d MMMM')}</p>
      </div>

      <section className="hero rounded-3xl p-5 shadow-card sm:p-6" aria-label="Balance">
        <div className="relative z-10">
          <div className="flex items-center justify-between text-sm text-white/80"><span>Money you have</span>
            <button onClick={toggleHide} className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10" aria-label={hide ? 'Show amounts' : 'Hide amounts'}>{hide ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
          <div className={cn('num -mt-1 text-4xl font-bold tracking-tight sm:text-5xl', blur)}>{money.fmt(available)}</div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-medium', blur)}><ArrowDownLeft className="h-4 w-4" />{month ? money.fmt(month.income) : '…'}<span className="font-normal text-white/70">in</span></span>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-medium', blur)}><ArrowUpRight className="h-4 w-4" />{month ? money.fmt(month.expense) : '…'}<span className="font-normal text-white/70">out</span></span>
            <span className="self-center text-xs text-white/70">{fmtDay(today, 'MMMM')}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {([['expense', 'Expense', ArrowUpRight, 'bg-destructive/15 text-destructive'], ['income', 'Income', ArrowDownLeft, 'bg-success/15 text-success'], ['transfer', 'Transfer', ArrowLeftRight, 'bg-blue-500/15 text-blue-600 dark:text-blue-400']] as const).map(([m, label, Icon, c]) => (
          <button key={m} onClick={() => qa.open(m)} className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card text-sm font-medium shadow-card transition active:scale-[0.98] hover:bg-muted"><span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full', c)}><Icon className="h-5 w-5" /></span>{label}</button>
        ))}
      </div>
      {mpesa && <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card p-3 text-sm"><span className="text-muted-foreground">Got new M-Pesa messages?</span><MpesaImportButton acc={mpesa} variant="default" /></div>}

      {live.length > 0 && (
        <section aria-label="Your accounts">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Your accounts</h2><Link href="/accounts" className="text-xs underline">Manage</Link></div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {live.map((a) => (
              <Link key={a.id} href={`/accounts/${a.id}`} className="min-w-[10.5rem] shrink-0 rounded-2xl border border-border/70 bg-card p-3.5 shadow-card transition hover:bg-muted">
                <div className="truncate text-xs text-muted-foreground">{a.name}</div>
                <div className={cn('num mt-1 text-lg font-semibold', blur)}>{money.fmt(balances[a.id] ?? 0)}</div>
              </Link>))}
          </div>
        </section>
      )}

      {!d && !loading ? null : !d ? <Skeleton className="h-40" /> : (<>
        {steps.some((x) => !x.done) && (
          <Card><CardHeader title="Get started" /><CardBody className="space-y-1">
            {steps.map((x) => (
              <Link key={x.label} href={x.href} className="flex min-h-[48px] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted">
                {x.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                <span className="min-w-0"><span className={cn('block text-sm font-medium', x.done && 'text-muted-foreground line-through')}>{x.label}</span>{!x.done && <span className="block text-xs text-muted-foreground">{x.hint}</span>}</span>
              </Link>))}
          </CardBody></Card>
        )}

        {(change !== null || topCat) && (
          <Card className="p-4"><div className="flex items-start gap-3">
            <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full', change !== null && change > 0 ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success')}>{change !== null && change > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}</span>
            <div className="min-w-0 text-sm">
              <p className="font-medium">{change === null ? 'Spending is building up this month.' : Math.abs(change) < 1 ? 'Spending is level with this time last month.' : `You've spent ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'more' : 'less'} than this time last month.`}</p>
              {topCat && <p className={cn('mt-0.5 text-muted-foreground', blur)}>Biggest category: {topCat.name} · {money.fmt(topCat.value)}</p>}
            </div>
          </div></Card>
        )}

        <Card><CardHeader title="Monthly budget" action={<Link href="/budgets" className="text-xs underline">{monthly.length ? 'Manage' : 'Set up'}</Link>} /><CardBody>
          {monthly.length > 0 ? (
            <div className="flex items-center gap-5">
              <Ring value={bPct} tone={bTone} size={104}><span className={cn('num text-xl font-bold', blur)}>{Math.round(bPct)}%</span><span className="text-[11px] text-muted-foreground">used</span></Ring>
              <div className="min-w-0 space-y-1 text-sm">
                <div className={cn('num text-lg font-semibold', mSpent > mAmt && 'text-destructive', blur)}>{mAmt - mSpent >= 0 ? `${money.fmt(mAmt - mSpent)} left` : `${money.fmt(mSpent - mAmt)} over`}</div>
                <div className={cn('num text-muted-foreground', blur)}>{money.fmt(mSpent)} of {money.fmt(mAmt)}</div>
                {mAmt > mSpent && <div className={cn('num text-xs text-muted-foreground', blur)}>About {money.fmt(Math.floor((mAmt - mSpent) / daysLeft))} a day for {daysLeft} more {daysLeft === 1 ? 'day' : 'days'}</div>}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Set a monthly budget to see how much you can still spend each day.</p>}
        </CardBody></Card>

        {needs > 0 && (
          <Card><CardHeader title="Needs your attention" /><CardBody className="space-y-2">
            {budgetAlerts.slice(0, 3).map((b) => <Link key={b.id} href="/budgets" className="flex items-center gap-3 rounded-xl bg-warning/10 p-3 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-warning" /><span className="min-w-0 flex-1"><b>{b.name}</b> budget {b.pct >= 100 ? 'is used up' : `is ${b.pct.toFixed(0)}% used`}</span></Link>)}
            {due.slice(0, 4).map(({ o, r }) => <Link key={o.id} href="/bills" className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"><span className="min-w-0"><span className="block truncate font-medium">{r.name}</span><span className={cn('text-xs', o.due_date < today ? 'text-destructive' : 'text-muted-foreground')}>{o.due_date < today ? 'Overdue · ' : 'Due '}{fmtDay(o.due_date)}</span></span><span className={cn('num shrink-0', r.kind === 'income' && 'text-success', blur)}>{r.kind === 'income' ? '+' : ''}{money.fmt(r.amount_minor)}</span></Link>)}
          </CardBody></Card>
        )}

        <Card><CardHeader title="Recent activity" action={<Link href="/transactions" className="text-xs underline">See all</Link>} /><CardBody>
          {d.txns.length ? <ul className="divide-y divide-border">{d.txns.slice(0, 6).map((t) => { const inc = IN.includes(t.kind); const cn_ = catName(t.category_id); return (
            <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm"><CatAvatar name={cn_} kind={t.kind} /><div className="min-w-0 flex-1"><div className="truncate font-medium">{t.description || t.counterparty || cn_}</div><div className="text-xs text-muted-foreground">{fmtDate(t.occurred_at, tz, 'd MMM, HH:mm')}{t.category_id ? ` · ${cn_}` : ''}</div></div>
              <span className={cn('num shrink-0 font-semibold', inc && 'text-success', blur)}>{inc ? '+' : '−'}{money.fmt(t.amount_minor)}</span></li>); })}</ul>
            : <Empty title="Nothing yet" hint="Tap Income or Expense above, or import your M-Pesa messages." />}
        </CardBody></Card>

        <button onClick={() => setDetails((v) => !v)} aria-expanded={details} className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-border/70 bg-card px-4 text-sm font-medium shadow-card hover:bg-muted">
          Charts &amp; trends<ChevronDown className={cn('h-5 w-5 transition-transform', details && 'rotate-180')} /></button>
        {details && <Details d={d} filter={filter} setFilter={setFilter} available={available} spendIds={spendIds} catName={catName} />}
      </>)}
    </div>
  );
}

function Details({ d, filter, setFilter, available, spendIds, catName }: { d: NonNullable<ReturnType<typeof useLoad<any>>['data']>; filter: FilterState; setFilter: (f: FilterState) => void; available: number; spendIds: Set<string>; catName: (id: string | null) => string }) {
  const { tz, money } = useApp(); const today = todayStr(tz);
  const inRange = d.txns.filter((t: any) => { const x = dayOf(t.occurred_at, tz); return x >= filter.from && x <= filter.to; });
  const s = summarize(inRange, catName, tz);
  const days = eachDay(filter.from, filter.to); const byMonth = days.length > 62; const bucket = (day: string) => (byMonth ? day.slice(0, 7) : day);
  const map = new Map<string, { income: number; expense: number }>();
  for (const x of s.byDay) { const k = bucket(x.date); const v = map.get(k) ?? { income: 0, expense: 0 }; v.income += x.income; v.expense += x.expense; map.set(k, v); }
  const flow = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ label: byMonth ? fmtDay(k + '-01', 'MMM yy') : fmtDay(k, 'd MMM'), Income: money.major(v.income), Expenses: money.major(v.expense) }));
  const spendTx = d.txns.filter((t: any) => spendIds.has(t.account_id));
  const hist = days.filter((x) => x <= today).filter((_, i, a) => a.length <= 90 || i % Math.ceil(a.length / 90) === 0 || i === a.length - 1).map((day) => ({
    label: fmtDay(day, 'd MMM'), Balance: money.major(available - spendTx.filter((t: any) => dayOf(t.occurred_at, tz) > day).reduce((a: number, t: any) => a + t.signed_amount_minor, 0)) }));
  return (
    <div className="space-y-4">
      <DateFilter value={filter} onChange={setFilter} tz={tz} />
      <Card><CardHeader title="Income vs expenses" action={<Badge>{money.fmt(s.net)} net</Badge>} /><CardBody><Bars data={flow} series={[{ key: 'Income', color: '#10b981' }, { key: 'Expenses', color: '#ef4444' }]} /></CardBody></Card>
      <Card><CardHeader title="Where your money went" /><CardBody><Pie1 center="Spent" data={s.byCat.slice(0, 6).map((x) => ({ name: x.name, value: money.major(x.value) }))} /></CardBody></Card>
      <Card><CardHeader title="Balance over time" /><CardBody><Lines data={hist} series={[{ key: 'Balance', color: '#10b981' }]} /></CardBody></Card>
      <p className="text-center text-xs text-muted-foreground">More reports are under <Link href="/reports" className="underline">Reports</Link>.</p>
    </div>
  );
}
