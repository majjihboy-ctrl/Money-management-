'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp, useLoad } from '@/components/app-provider';
import { Badge, Button, Card, CardBody, CardHeader, Empty, Field, Input, Loading, PageHeader, Progress, Select, Stat, Toggle } from '@/components/ui';
import { addDays, fmtDate, fmtDay, todayStr } from '@/lib/dates';
import { loadDaily } from '@/lib/daily';
import { errMsg, cn } from '@/lib/utils';
import { inputValue } from '@/lib/money';

export default function Daily() {
  const { sb, tz, money, accounts, categories, user, refresh } = useApp();
  const today = todayStr(tz);
  const [date, setDate] = useState(today);
  const [edit, setEdit] = useState(false);
  const { data: d, loading, error } = useLoad(() => loadDaily(sb, tz, accounts, date), [date, accounts.length]);
  const [f, setF] = useState({ mode: 'manual', limit: '', period: 'monthly', end: '', bills: true, savings: true, debts: true, extra: '' });
  useEffect(() => { if (d) setF({ mode: d.plan.mode, limit: inputValue(d.plan.manual_daily_limit_minor, money.cur), period: d.plan.period, end: d.plan.period_end ?? '', bills: d.plan.deduct_bills, savings: d.plan.deduct_savings, debts: d.plan.deduct_debts, extra: inputValue(d.plan.extra_reserve_minor, money.cur) }); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    const lim = money.parse(f.limit || '0'), ex = money.parse(f.extra || '0');
    if (lim === null || ex === null) return void toast.error('Enter valid amounts');
    if (f.mode === 'auto' && f.period === 'custom' && (!f.end || f.end < today)) return void toast.error('Choose a custom end date that is today or later');
    const { error } = await sb.from('spending_plans').upsert({ user_id: user.id, mode: f.mode, manual_daily_limit_minor: lim, period: f.period, period_end: f.period === 'custom' ? f.end : null, deduct_bills: f.bills, deduct_savings: f.savings, deduct_debts: f.debts, extra_reserve_minor: ex });
    if (error) return void toast.error(errMsg(error)); toast.success('Spending plan saved'); setEdit(false); refresh();
  }
  if (error) return <Empty title="Could not load daily spending" hint={error} />;
  const cat = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '';
  let body: React.ReactNode = <Loading rows={4} />;
  if (d) {
    const tx = d.dayTxns;
    const income = tx.filter((t) => t.kind === 'income').reduce((a, t) => a + t.amount_minor, 0);
    const exp = tx.filter((t) => t.kind === 'expense' || t.kind === 'debt_payment');
    const spent = exp.reduce((a, t) => a + t.amount_minor, 0);
    const transferred = tx.filter((t) => t.kind === 'transfer_out').reduce((a, t) => a + t.amount_minor, 0);
    const net = income - spent; const largest = exp.reduce<typeof exp[number] | null>((m, t) => (!m || t.amount_minor > m.amount_minor ? t : m), null);
    const remaining = d.limit - spent; const pct = d.limit > 0 ? (spent / d.limit) * 100 : 0; const over = d.limit > 0 && spent > d.limit;
    const closing = d.opening + tx.filter((t) => accounts.find((a) => a.id === t.account_id && !a.archived_at && a.type !== 'savings')).reduce((a, t) => a + t.signed_amount_minor, 0);
    body = (
      <>
        {over && <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div><b>Daily limit exceeded</b> by {money.fmt(spent - d.limit)}. Your records are unchanged — this is only a warning.</div></div>}
        {!over && d.limit > 0 && pct >= 80 && <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />You have used {pct.toFixed(0)}% of today's limit.</div>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Opening balance" value={money.fmt(d.opening)} sub="Spending accounts" />
          <Stat label="Income received" value={money.fmt(income)} tone="success" />
          <Stat label="Total spent" value={money.fmt(spent)} tone="danger" />
          <Stat label="Money transferred" value={money.fmt(transferred)} sub="Between accounts" />
          <Stat label="Net cash flow" value={money.fmt(net)} tone={net >= 0 ? 'success' : 'danger'} />
          <Stat label={date === today ? 'Current balance' : 'Closing balance'} value={money.fmt(date === today ? d.current : closing)} />
          <Stat label="Transactions" value={String(tx.length)} />
          <Stat label="Largest expense" value={largest ? money.fmt(largest.amount_minor) : '—'} sub={largest ? largest.description || largest.counterparty || cat(largest.category_id) : undefined} />
        </div>
        <Card className="mt-4">
          <CardHeader title={d.plan.mode === 'auto' ? 'Recommended spending limit' : 'Daily spending limit'} action={<Button variant="outline" size="sm" onClick={() => setEdit(!edit)}>{edit ? 'Close' : 'Configure'}</Button>} />
          <CardBody>
            {d.limit > 0 ? (<>
              <div className="flex flex-wrap items-end justify-between gap-2"><div><div className="num text-3xl font-semibold">{money.fmt(d.limit)}</div><div className="text-sm text-muted-foreground">Spent {money.fmt(spent)} · {over ? 'over by' : 'remaining'} <b className={over ? 'text-destructive' : 'text-success'}>{money.fmt(Math.abs(remaining))}</b></div></div>
                <Badge tone={over ? 'danger' : pct >= 80 ? 'warning' : 'success'}>{over ? 'Over budget' : 'Under budget'} · {pct.toFixed(0)}% used</Badge></div>
              <div className="mt-3"><Progress value={pct} tone={over ? 'danger' : pct >= 80 ? 'warning' : 'success'} /></div>
            </>) : <p className="text-sm text-muted-foreground">No daily limit yet. {d.plan.mode === 'auto' ? 'Your available funds after reserves are zero.' : 'Click Configure to set one manually or calculate it automatically.'}</p>}
            {d.plan.mode === 'auto' && (
              <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                <b className="text-foreground">How this is calculated:</b> (Opening balance {money.fmt(d.opening)} − reserves {money.fmt(d.reserves)}) ÷ {d.remainingDays} remaining day{d.remainingDays > 1 ? 's' : ''} (including this day, until {fmtDay(d.end, 'd MMM')}). Reserves: bills {money.fmt(d.bills)}, debt payments {money.fmt(d.debts)}, savings earmarks {money.fmt(d.savings)}{d.plan.extra_reserve_minor ? `, other ${money.fmt(d.plan.extra_reserve_minor)}` : ''}.
              </div>
            )}
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />The daily allowance is a budgeting recommendation, not a guaranteed amount of money available. Exceeding it never changes or deletes your records.</p>
            {edit && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Method"><Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="manual">Manual daily limit</option><option value="auto">Automatic calculator</option></Select></Field>
                  {f.mode === 'manual' ? <Field label={`Daily limit (${money.cur})`}><Input inputMode="decimal" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} /></Field> : <Field label="Budgeting period"><Select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom period</option></Select></Field>}
                </div>
                {f.mode === 'auto' && (<>
                  {f.period === 'custom' && <Field label="Period ends on"><Input type="date" min={today} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>}
                  <div className="rounded-lg border border-border p-3"><p className="mb-1 text-sm font-medium">Deduct before calculating</p>
                    <Toggle label="Bills due in the period" checked={f.bills} onChange={(v) => setF({ ...f, bills: v })} />
                    <Toggle label="Debt payments due in the period" checked={f.debts} onChange={(v) => setF({ ...f, debts: v })} />
                    <Toggle label="Money earmarked for savings goals" checked={f.savings} onChange={(v) => setF({ ...f, savings: v })} /></div>
                  <Field label={`Other reserve (${money.cur})`}><Input inputMode="decimal" value={f.extra} onChange={(e) => setF({ ...f, extra: e.target.value })} /></Field>
                </>)}
                <Button onClick={save}>Save plan</Button>
              </div>
            )}
          </CardBody>
        </Card>
        <Card className="mt-4">
          <CardHeader title={`Transactions · ${fmtDay(date, 'EEEE d MMM yyyy')}`} />
          {tx.length ? <ul className="divide-y divide-border">{[...tx].reverse().map((t) => { const inflow = ['income', 'deposit', 'transfer_in', 'debt_collection'].includes(t.kind); return (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><div className="min-w-0"><div className="truncate font-medium">{t.description || t.counterparty || cat(t.category_id) || t.kind.replace('_', ' ')}</div><div className="text-xs text-muted-foreground">{fmtDate(t.occurred_at, tz, 'HH:mm')} · {accounts.find((a) => a.id === t.account_id)?.name}{cat(t.category_id) ? ` · ${cat(t.category_id)}` : ''}</div></div><span className={cn('num font-semibold', inflow && 'text-success')}>{inflow ? '+' : '−'}{money.fmt(t.amount_minor)}</span></li>); })}</ul>
            : <Empty title="No transactions on this day" hint="Use the + button to record one." />}
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Daily Spending" desc="Track today against your spending limit." />
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" className="w-44" value={date} max={addDays(today, 365)} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Select date" />
        <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight className="h-4 w-4" /></Button>
        {date !== today && <Button variant="ghost" size="sm" onClick={() => setDate(today)}>Today</Button>}
        {loading && d && <span className="text-xs text-muted-foreground">Updating…</span>}
      </div>
      {body}
    </>
  );
}
