'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp, useLoad } from '@/components/app-provider';
import { Badge, Button, Card, CardHeader, CardBody, Empty, Loading, PageHeader } from '@/components/ui';
import { addDays, addMonths, dayOf, dow, endOfMonth, fmtDate, fmtDay, startOfMonth, todayStr } from '@/lib/dates';
import { fetchTxns } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Debt, Goal, Occurrence, Rule } from '@/lib/types';

export default function CalendarPage() {
  const { sb, tz, money, categories, accounts } = useApp(); const today = todayStr(tz);
  const [month, setMonth] = useState(startOfMonth(today)); const [sel, setSel] = useState(today);
  const last = endOfMonth(month);
  const { data, loading, error } = useLoad(async () => {
    const [txns, occ, rules, debts, goals] = await Promise.all([fetchTxns(sb, tz, month, last), sb.from('recurring_occurrences').select('*').eq('state', 'pending').gte('due_date', month).lte('due_date', last),
      sb.from('recurring_rules').select('*'), sb.from('debts').select('*').eq('status', 'active').gte('due_date', month).lte('due_date', last), sb.from('savings_goals').select('*').in('status', ['active']).gte('target_date', month).lte('target_date', last)]);
    return { txns, occ: (occ.data ?? []) as Occurrence[], rules: new Map(((rules.data ?? []) as Rule[]).map((r) => [r.id, r])), debts: (debts.data ?? []) as Debt[], goals: (goals.data ?? []) as Goal[] };
  }, [month]);
  if (error) return <Empty title="Could not load calendar" hint={error} />;
  const lead = (dow(month) + 6) % 7; const n = Number(last.slice(8));
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => month.slice(0, 8) + String(i + 1).padStart(2, '0'))];
  const per = (day: string) => {
    if (!data) return { inc: 0, exp: 0, bills: 0, debts: 0, goals: 0 };
    return { inc: data.txns.filter((t) => t.kind === 'income' && dayOf(t.occurred_at, tz) === day).reduce((a, t) => a + t.amount_minor, 0), exp: data.txns.filter((t) => (t.kind === 'expense' || t.kind === 'debt_payment') && dayOf(t.occurred_at, tz) === day).reduce((a, t) => a + t.amount_minor, 0),
      bills: data.occ.filter((o) => o.due_date === day).length, debts: data.debts.filter((d) => d.due_date === day).length, goals: data.goals.filter((g) => g.target_date === day).length };
  };
  const selTx = data?.txns.filter((t) => dayOf(t.occurred_at, tz) === sel) ?? [];
  return (
    <>
      <PageHeader title="Calendar" desc="Income, spending, bills, debts and goals by date." />
      <div className="mb-3 flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></Button><div className="w-40 text-center font-semibold">{fmtDay(month, 'MMMM yyyy')}</div><Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => { setMonth(startOfMonth(today)); setSel(today); }}>Today</Button></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-2">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">{cells.map((day, i) => { if (!day) return <div key={i} />; const p = per(day); return (
            <button key={day} onClick={() => setSel(day)} aria-label={fmtDay(day, 'd MMMM')} className={cn('flex min-h-[64px] flex-col items-start rounded-md border p-1 text-left text-[10px] sm:min-h-[84px] sm:p-1.5', sel === day ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted', day === today && 'ring-1 ring-primary')}>
              <span className="text-xs font-medium">{Number(day.slice(8))}</span>
              {p.inc > 0 && <span className="num w-full truncate text-success">+{money.fmtC(p.inc)}</span>}{p.exp > 0 && <span className="num w-full truncate text-destructive">−{money.fmtC(p.exp)}</span>}
              <span className="mt-auto flex gap-0.5">{p.bills > 0 && <i className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Bill" />}{p.debts > 0 && <i className="h-1.5 w-1.5 rounded-full bg-purple-500" title="Debt due" />}{p.goals > 0 && <i className="h-1.5 w-1.5 rounded-full bg-blue-500" title="Goal date" />}</span>
            </button>); })}</div>
          <div className="mt-2 flex flex-wrap gap-3 px-1 text-xs text-muted-foreground"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Bill / scheduled</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-purple-500" />Debt due</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />Goal date</span></div>
        </Card>
        <Card><CardHeader title={fmtDay(sel, 'EEEE d MMMM yyyy')} />
          <CardBody className="space-y-4">
            {loading && !data ? <Loading rows={2} /> : <>
              {data?.occ.filter((o) => o.due_date === sel).map((o) => { const r = data.rules.get(o.rule_id); return r && <div key={o.id} className="flex justify-between text-sm"><span><Badge tone="warning">{r.kind === 'income' ? 'Expected' : 'Bill'}</Badge> {r.name}</span><span className="num">{money.fmt(r.amount_minor)}</span></div>; })}
              {data?.debts.filter((d) => d.due_date === sel).map((d) => <div key={d.id} className="flex justify-between text-sm"><span><Badge tone="info">Debt</Badge> {d.counterparty}</span><span className="num">{money.fmt(d.min_payment_minor ?? d.outstanding_minor)}</span></div>)}
              {data?.goals.filter((g) => g.target_date === sel).map((g) => <div key={g.id} className="text-sm"><Badge tone="info">Goal target</Badge> {g.name}</div>)}
              {selTx.length ? <ul className="divide-y divide-border">{selTx.map((t) => { const inflow = ['income', 'deposit', 'transfer_in', 'debt_collection'].includes(t.kind); return <li key={t.id} className="flex justify-between gap-2 py-2 text-sm"><div className="min-w-0"><div className="truncate">{t.description || t.counterparty || categories.find((c) => c.id === t.category_id)?.name || t.kind.replace('_', ' ')}</div><div className="text-xs text-muted-foreground">{fmtDate(t.occurred_at, tz, 'HH:mm')} · {accounts.find((a) => a.id === t.account_id)?.name}</div></div><span className={cn('num', inflow && 'text-success')}>{inflow ? '+' : '−'}{money.fmt(t.amount_minor)}</span></li>; })}</ul> : <p className="text-sm text-muted-foreground">No transactions on this day.</p>}
            </>}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
