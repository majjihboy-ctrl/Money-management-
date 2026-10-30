'use client';
import Link from 'next/link';
import { AlertCircle, Info, TrendingUp, TrendingDown, Lightbulb } from 'lucide-react';
import { useApp, useLoad } from '@/components/app-provider';
import { Badge, Card, CardBody, CardHeader, Empty, Loading, PageHeader } from '@/components/ui';
import { addDays, addMonths, dayOf, daysBetween, endOfMonth, fmtDay, startOfMonth, todayStr } from '@/lib/dates';
import { fetchTxns, loadBudgets } from '@/lib/queries';
import { catAmounts, isExpense, summarize } from '@/lib/calc';
import type { Goal, Occurrence, Rule, Txn } from '@/lib/types';
import { goalProgress } from '@/lib/queries';

type Insight = { tone: 'info' | 'warn' | 'good'; title: string; body: string; estimate?: boolean };
const MONTHLY = { daily: 30, weekly: 4.345, biweekly: 2.17, monthly: 1, quarterly: 1 / 3, annual: 1 / 12, custom: 1 } as Record<string, number>;

export default function Insights() {
  const { sb, tz, money, categories, accounts, balances } = useApp(); const today = todayStr(tz); const f = money.fmt;
  const { data, loading, error } = useLoad(async () => {
    const tm = startOfMonth(today);
    const [txns, budgets, rules, occ, goals, gp] = await Promise.all([fetchTxns(sb, tz, addMonths(tm, -6)), loadBudgets(sb, tz, today),
      sb.from('recurring_rules').select('*').eq('is_active', true).eq('kind', 'expense'), sb.from('recurring_occurrences').select('*').eq('state', 'pending').gte('due_date', today).lte('due_date', endOfMonth(today)),
      sb.from('savings_goals').select('*').eq('status', 'active'), goalProgress(sb)]);
    return { txns, budgets, rules: (rules.data ?? []) as Rule[], occ: (occ.data ?? []) as Occurrence[], goals: (goals.data ?? []) as Goal[], gp };
  }, []);
  if (error) return <Empty title="Could not load insights" hint={error} />;
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';
  const out: Insight[] = [];
  if (data) {
    const tm = startOfMonth(today), lm = addMonths(tm, -1); const elapsed = daysBetween(tm, today) + 1;
    const inMonth = (t: Txn, m: string) => dayOf(t.occurred_at, tz).startsWith(m.slice(0, 7));
    const cur = data.txns.filter((t) => inMonth(t, tm)); const sameDaysLast = data.txns.filter((t) => inMonth(t, lm) && Number(dayOf(t.occurred_at, tz).slice(8)) <= elapsed);
    const s = summarize(cur, catName, tz); const sp = summarize(sameDaysLast, catName, tz);
    const expCount = cur.filter((t) => isExpense(t.kind)).length;
    if (!expCount) out.push({ tone: 'info', title: 'Not enough data yet', body: 'Record some expenses this month and insights will appear here. Everything below is computed only from the records you enter.' });
    if (s.byCat[0]) out.push({ tone: 'info', title: `Largest spending category: ${s.byCat[0].name}`, body: `${f(s.byCat[0].value)} so far this month (${s.expense ? ((s.byCat[0].value / s.expense) * 100).toFixed(0) : 0}% of expenses).` });
    // category increases (only with sufficient data in both periods)
    const countCat = (txns: Txn[], name: string) => txns.filter((t) => isExpense(t.kind) && catAmounts(t).some((a) => catName(a.category_id) === name)).length;
    for (const c of s.byCat.slice(0, 6)) { const prev = sp.byCat.find((x) => x.name === c.name); if (!prev || countCat(cur, c.name) < 3 || countCat(sameDaysLast, c.name) < 3) continue; const ch = ((c.value - prev.value) / prev.value) * 100;
      if (ch >= 20) out.push({ tone: 'warn', title: `${c.name} spending is up ${ch.toFixed(0)}%`, body: `${f(c.value)} vs ${f(prev.value)} over the same days last month.` }); else if (ch <= -20) out.push({ tone: 'good', title: `${c.name} spending is down ${Math.abs(ch).toFixed(0)}%`, body: `${f(c.value)} vs ${f(prev.value)} over the same days last month.` }); }
    if (expCount) out.push({ tone: 'info', title: `Average daily spending: ${f(Math.round(s.expense / elapsed))}`, body: `Across ${elapsed} day${elapsed > 1 ? 's' : ''} of this month so far.` });
    const monthsData = new Map<string, number>(); for (const t of data.txns) if (isExpense(t.kind) && !dayOf(t.occurred_at, tz).startsWith(tm.slice(0, 7))) { const k = dayOf(t.occurred_at, tz).slice(0, 7); monthsData.set(k, (monthsData.get(k) ?? 0) + t.amount_minor); }
    if (monthsData.size >= 2) out.push({ tone: 'info', title: `Average monthly expenses: ${f(Math.round([...monthsData.values()].reduce((a, b) => a + b, 0) / monthsData.size))}`, body: `Based on ${monthsData.size} previous months with recorded expenses.` });
    const top = [...s.byDay].sort((a, b) => b.expense - a.expense)[0]; if (top && top.expense > 0) out.push({ tone: 'info', title: `Highest-spending day: ${fmtDay(top.date, 'EEE d MMM')}`, body: `${f(top.expense)} spent.` });
    const bills = [...data.rules].sort((a, b) => b.amount_minor * (MONTHLY[b.frequency] ?? 1) - a.amount_minor * (MONTHLY[a.frequency] ?? 1)).slice(0, 3);
    if (bills.length) out.push({ tone: 'info', title: 'Most expensive recurring bills', body: bills.map((b) => `${b.name} (~${f(Math.round(b.amount_minor * (MONTHLY[b.frequency] ?? 1)))}/month)`).join(', ') + '. Monthly figures are estimates.', estimate: true });
    for (const g of data.goals.slice(0, 3)) out.push({ tone: 'good', title: `${g.name}: ${(((data.gp[g.id] ?? 0) / g.target_minor) * 100).toFixed(0)}% saved`, body: `${f(data.gp[g.id] ?? 0)} of ${f(g.target_minor)}.` });
    for (const b of data.budgets.filter((x) => x.pct >= 75)) out.push({ tone: 'warn', title: `${b.name}: ${b.pct.toFixed(0)}% used`, body: `${f(b.spent)} of ${f(b.amount_minor)} (${b.status}).` });
    // projection
    const spendIds = new Set(accounts.filter((a) => !a.archived_at && a.type !== 'savings').map((a) => a.id)); const avail = [...spendIds].reduce((q, id) => q + (balances[id] ?? 0), 0);
    if (expCount >= 5 && elapsed >= 5) { const rm = new Map(data.rules.map((r) => [r.id, r])); const pending = data.occ.reduce((q, o) => q + (rm.get(o.rule_id)?.amount_minor ?? 0), 0); const remDays = daysBetween(today, endOfMonth(today));
      const variable = summarize(cur.filter((t) => !t.is_recurring), catName, tz).expense / elapsed; const proj = avail - variable * remDays - pending;
      out.push({ tone: proj < 0 ? 'warn' : 'info', title: `Projected month-end balance: ${f(Math.round(proj))}`, body: `Estimate: current spendable balance ${f(avail)} minus typical non-recurring spending (${f(Math.round(variable))}/day × ${remDays} days) minus ${f(pending)} of unpaid recurring bills. Ignores any income not yet recorded.`, estimate: true }); }
    // opportunities
    if (s.expense > 0 && s.nonEssential / s.expense > 0.3) out.push({ tone: 'warn', title: 'Non-essential spending is high', body: `${((s.nonEssential / s.expense) * 100).toFixed(0)}% of this month's expenses (${f(s.nonEssential)}) are marked non-essential. This is the most flexible place to cut.` });
    const subs = s.byCat.find((x) => x.name === 'Subscriptions'); if (subs) out.push({ tone: 'info', title: `Subscriptions: ${f(subs.value)} this month`, body: 'Review whether you still use each one.' });
    const bank = s.byCat.find((x) => x.name === 'Bank Charges'); if (bank && s.expense && bank.value / s.expense > 0.02) out.push({ tone: 'warn', title: `Bank charges: ${f(bank.value)} this month`, body: 'Check whether a different account type or transfer method would cost less.' });
  }
  const Icon = ({ t }: { t: Insight['tone'] }) => t === 'warn' ? <AlertCircle className="h-5 w-5 shrink-0 text-warning" /> : t === 'good' ? <TrendingDown className="h-5 w-5 shrink-0 text-success" /> : <Info className="h-5 w-5 shrink-0 text-blue-500" />;
  return (
    <>
      <PageHeader title="Financial insights" desc="Rule-based observations from the records you have entered." />
      {loading && !data ? <Loading rows={5} /> : (
        <div className="grid gap-3 md:grid-cols-2">{out.map((i, k) => <Card key={k} className="flex gap-3 p-4"><Icon t={i.tone} /><div><div className="flex flex-wrap items-center gap-2 font-medium">{i.title}{i.estimate && <Badge tone="info">Estimate</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{i.body}</p></div></Card>)}</div>
      )}
      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />Insights use only the transactions you record in this app. Money Manager Pro is not connected to any bank or M-Pesa account, and projections are estimates, not guarantees. See <Link className="underline" href="/reports">Reports</Link> for the underlying figures.</p>
    </>
  );
}
