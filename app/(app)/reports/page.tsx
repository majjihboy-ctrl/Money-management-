'use client';
import { useState } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { useApp, useLoad } from '@/components/app-provider';
import { DateFilter, initFilter, type FilterState } from '@/components/date-filter';
import { Bars, Lines, Pie1 } from '@/components/charts';
import { Badge, Button, Card, CardBody, CardHeader, Empty, Loading, PageHeader, Progress, Select, Stat } from '@/components/ui';
import { addMonths, dayOf, eachDay, fmtDate, fmtDay, startOfMonth, startOfWeek, startOfYear, todayStr } from '@/lib/dates';
import { fetchTxns, goalProgress, loadBudgets } from '@/lib/queries';
import { catAmounts, pctChange, summarize, isExpense } from '@/lib/calc';
import { download, toCSV, toPDF } from '@/lib/export';
import { exponent } from '@/lib/money';
import type { Debt, Goal, Txn } from '@/lib/types';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">{title}</h2><div className="grid gap-4 lg:grid-cols-2">{children}</div></section>;
const Table = ({ head, rows }: { head: string[]; rows: (string | number)[][] }) => rows.length ? (
  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground">{head.map((h, i) => <th key={h} className={`py-2 pr-3 font-medium ${i > 0 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border/60 last:border-0">{r.map((c, j) => <td key={j} className={`num py-2 pr-3 ${j > 0 ? 'text-right' : ''}`}>{c}</td>)}</tr>)}</tbody></table></div>) : <Empty title="No data" />;
const Delta = ({ v }: { v: number | null }) => v === null ? <span className="text-muted-foreground">n/a</span> : <span className={v > 0 ? 'text-destructive' : 'text-success'}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>;

export default function Reports() {
  const { sb, tz, money, accounts, categories, balances } = useApp(); const today = todayStr(tz);
  const [filter, setFilter] = useState<FilterState>(initFilter(tz, 'month')); const [acc, setAcc] = useState(''); const [cat, setCat] = useState('');
  const catName = (id: string | null, t?: Txn) => categories.find((c) => c.id === id)?.name ?? (t?.kind === 'debt_payment' ? 'Debt Repayment' : 'Uncategorised');
  const { data: d, loading, error } = useLoad(async () => {
    const yearStart = startOfYear(addMonths(startOfYear(today), -12));
    const since = [filter.from, yearStart].sort()[0];
    const [all, budgets, gp, goals, debts] = await Promise.all([
      fetchTxns(sb, tz, since, undefined, { accountId: acc || undefined }), loadBudgets(sb, tz), goalProgress(sb),
      sb.from('savings_goals').select('*').neq('status', 'archived'), sb.from('debts').select('*').eq('status', 'active'),
    ]);
    return { all, budgets, gp, goals: (goals.data ?? []) as Goal[], debts: (debts.data ?? []) as Debt[] };
  }, [filter.from, filter.to, acc, cat]);
  if (error) return <Empty title="Could not load reports" hint={error} />;

  let body: React.ReactNode = <Loading rows={5} />;
  if (d) {
    const matchCat = (t: Txn) => !cat || catAmounts(t).some((a) => a.category_id === cat);
    const txns = d.all.filter(matchCat); const inRange = txns.filter((t) => { const x = dayOf(t.occurred_at, tz); return x >= filter.from && x <= filter.to; });
    const s = summarize(inRange, catName, tz); const M = money.major;
    const days = eachDay(filter.from, filter.to);
    const group = (keyFn: (day: string) => string, labelFn: (k: string) => string) => { const m = new Map<string, { income: number; expense: number }>(); for (const x of s.byDay) { const k = keyFn(x.date); const v = m.get(k) ?? { income: 0, expense: 0 }; v.income += x.income; v.expense += x.expense; m.set(k, v); } return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ label: labelFn(k), Income: M(v.income), Expenses: M(v.expense), Net: M(v.income - v.expense), 'Savings rate %': v.income > 0 ? Number((((v.income - v.expense) / v.income) * 100).toFixed(1)) : 0 })); };
    const byDay = group((x) => x, (k) => fmtDay(k, 'd MMM')); const byWeek = group((x) => startOfWeek(x), (k) => 'Wk ' + fmtDay(k, 'd MMM')); const byMonth = group((x) => x.slice(0, 7), (k) => fmtDay(k + '-01', 'MMM yy'));
    const largest = inRange.filter((t) => isExpense(t.kind)).sort((a, b) => b.amount_minor - a.amount_minor).slice(0, 10);
    const freq = new Map<string, { n: number; total: number }>(); for (const t of inRange.filter((t) => t.kind === 'expense')) { const k = t.description || t.counterparty || catName(t.category_id); const v = freq.get(k) ?? { n: 0, total: 0 }; v.n++; v.total += t.amount_minor; freq.set(k, v); }
    const frequent = [...freq.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10);
    // account balance history
    const ids = new Set((acc ? accounts.filter((a) => a.id === acc) : accounts.filter((a) => !a.archived_at)).map((a) => a.id));
    const cur = [...ids].reduce((q, id) => q + (balances[id] ?? 0), 0); const mine = d.all.filter((t) => ids.has(t.account_id));
    const step = Math.max(1, Math.ceil(days.length / 90));
    const hist = days.filter((x) => x <= today).filter((_, i) => i % step === 0).map((day) => ({ label: fmtDay(day, 'd MMM'), Balance: M(cur - mine.filter((t) => dayOf(t.occurred_at, tz) > day).reduce((q, t) => q + t.signed_amount_minor, 0)) }));
    // comparisons
    const tm = startOfMonth(today), lm = addMonths(tm, -1); const month = (m: string) => summarize(d.all.filter((t) => dayOf(t.occurred_at, tz).startsWith(m.slice(0, 7))), catName, tz);
    const a = month(tm), b = month(lm);
    const yr = today.slice(0, 4), py = String(Number(yr) - 1);
    const yoy = Array.from({ length: 12 }, (_, i) => { const mm = String(i + 1).padStart(2, '0'); const f = (y: string) => summarize(d.all.filter((t) => dayOf(t.occurred_at, tz).startsWith(`${y}-${mm}`) && isExpense(t.kind)), catName, tz).expense; return { label: fmtDay(`${yr}-${mm}-01`, 'MMM'), [yr]: M(f(yr)), [py]: M(f(py)) }; });
    const rows = [['Date', 'Type', 'Category', 'Description', 'Merchant/Source', 'Account', 'Method', 'Amount', 'Essential']];
    const txRows = inRange.map((t) => [fmtDate(t.occurred_at, tz, 'yyyy-MM-dd HH:mm'), t.kind, catName(t.category_id, t), t.description ?? '', t.counterparty ?? '', accounts.find((x) => x.id === t.account_id)?.name ?? '', t.payment_method ?? '', (t.signed_amount_minor / 10 ** exponent(money.cur)).toFixed(exponent(money.cur)), t.is_essential === null ? '' : t.is_essential ? 'Yes' : 'No']);
    const label = `${filter.from}_to_${filter.to}`;
    const exportCSV = () => { download(`money-report-${label}.csv`, toCSV([...rows, ...txRows]), 'text/csv;charset=utf-8'); };
    const exportPDF = async () => { try { await toPDF('Money Manager Pro report', `${filter.from} to ${filter.to} · ${money.cur}`, [
      { heading: 'Summary', head: ['Metric', 'Amount'], body: [['Income', money.fmt(s.income)], ['Expenses', money.fmt(s.expense)], ['Net cash flow', money.fmt(s.net)], ['Savings rate', s.savingsRate === null ? 'n/a' : s.savingsRate.toFixed(1) + '%']] },
      { heading: 'Expenses by category', head: ['Category', 'Amount'], body: s.byCat.map((x) => [x.name, money.fmt(x.value)]) },
      { heading: 'Income by source', head: ['Source', 'Amount'], body: s.incSrc.map((x) => [x.name, money.fmt(x.value)]) },
      { heading: 'Transactions (first 300)', head: ['Date', 'Type', 'Category', 'Description', 'Amount'], body: txRows.slice(0, 300).map((r) => [r[0], r[1], r[2], r[3], r[7]]) }], `money-report-${label}.pdf`); } catch { toast.error('Could not create PDF'); } };
    const pie = (m: { name: string; value: number }[]) => m.slice(0, 8).map((x) => ({ name: x.name, value: M(x.value) }));
    const cmp = (l: string, x: number, y: number) => [l, money.fmt(x), money.fmt(y), <Delta key={l} v={pctChange(x, y)} />] as unknown as (string | number)[];
    body = (
      <>
        <div className="mt-4 flex flex-wrap gap-2 no-print"><Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4" />CSV</Button><Button variant="outline" onClick={exportCSV}><FileSpreadsheet className="h-4 w-4" />Excel (opens CSV)</Button><Button variant="outline" onClick={exportPDF}><FileText className="h-4 w-4" />PDF</Button></div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Income" value={money.fmt(s.income)} tone="success" /><Stat label="Expenses" value={money.fmt(s.expense)} tone="danger" sub={s.debtPaid ? `incl. ${money.fmt(s.debtPaid)} debt payments` : undefined} />
          <Stat label="Net cash flow" value={money.fmt(s.net)} tone={s.net >= 0 ? 'success' : 'danger'} sub="Income − Expenses" /><Stat label="Savings rate" value={s.savingsRate === null ? 'n/a' : s.savingsRate.toFixed(1) + '%'} sub={s.savingsRate === null ? 'No income in this period' : 'Net savings ÷ Income'} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Net savings = Income − Expenses. Transfers between your own accounts (including to savings accounts) are neither income nor expense, so money moved to savings stays part of net savings.</p>
        <Section title="Income">
          <Card><CardHeader title="Income by day" /><CardBody><Bars data={byDay} series={[{ key: 'Income', color: '#10b981' }]} /></CardBody></Card>
          <Card><CardHeader title="Income by month" /><CardBody><Bars data={byMonth} series={[{ key: 'Income', color: '#10b981' }]} /></CardBody></Card>
          <Card><CardHeader title="By category" /><CardBody><Pie1 data={pie(s.incCat)} /></CardBody></Card>
          <Card><CardHeader title="By source" /><CardBody><Table head={['Source', 'Amount']} rows={s.incSrc.slice(0, 12).map((x) => [x.name, money.fmt(x.value)])} /></CardBody></Card>
        </Section>
        <Section title="Expenses">
          <Card><CardHeader title="By day" /><CardBody><Bars data={byDay} series={[{ key: 'Expenses', color: '#ef4444' }]} /></CardBody></Card>
          <Card><CardHeader title="By week" /><CardBody><Bars data={byWeek} series={[{ key: 'Expenses', color: '#ef4444' }]} /></CardBody></Card>
          <Card><CardHeader title="By month" /><CardBody><Bars data={byMonth} series={[{ key: 'Expenses', color: '#ef4444' }]} /></CardBody></Card>
          <Card><CardHeader title="By category" /><CardBody><Pie1 data={pie(s.byCat)} /></CardBody></Card>
          <Card><CardHeader title="By payment method" /><CardBody><Pie1 data={pie(s.byMethod)} /></CardBody></Card>
          <Card><CardHeader title="Essential vs non-essential" /><CardBody><Pie1 data={[{ name: 'Essential', value: M(s.essential) }, { name: 'Non-essential', value: M(s.nonEssential) }].filter((x) => x.value > 0)} /></CardBody></Card>
          <Card><CardHeader title="Largest expenses" /><CardBody><Table head={['Expense', 'Date', 'Amount']} rows={largest.map((t) => [t.description || t.counterparty || catName(t.category_id, t), fmtDate(t.occurred_at, tz, 'd MMM'), money.fmt(t.amount_minor)])} /></CardBody></Card>
          <Card><CardHeader title="Most frequent expenses" /><CardBody><Table head={['Expense', 'Times', 'Total']} rows={frequent.map(([k, v]) => [k, v.n, money.fmt(v.total)])} /></CardBody></Card>
        </Section>
        <Section title="Financial position">
          <Card><CardHeader title="Income vs expenses" /><CardBody><Bars data={byMonth} series={[{ key: 'Income', color: '#10b981' }, { key: 'Expenses', color: '#ef4444' }]} /></CardBody></Card>
          <Card><CardHeader title="Net cash flow" /><CardBody><Bars data={byMonth} series={[{ key: 'Net', color: '#3b82f6' }]} /></CardBody></Card>
          <Card><CardHeader title="Savings rate by month (%)" /><CardBody><Lines data={byMonth} series={[{ key: 'Savings rate %', color: '#8b5cf6' }]} /></CardBody></Card>
          <Card><CardHeader title="Account balance history" /><CardBody><Lines data={hist} series={[{ key: 'Balance', color: '#10b981' }]} /></CardBody></Card>
          <Card><CardHeader title="Budget performance" /><CardBody>{d.budgets.length ? <div className="space-y-3">{d.budgets.map((x) => <div key={x.id}><div className="mb-1 flex justify-between text-sm"><span>{x.name}</span><Badge tone={x.status === 'Exceeded' ? 'danger' : x.status === 'On Track' ? 'success' : 'warning'}>{x.status}</Badge></div><Progress value={x.pct} tone={x.pct >= 100 ? 'danger' : x.pct >= 75 ? 'warning' : 'success'} /><div className="num mt-1 text-xs text-muted-foreground">{money.fmt(x.spent)} / {money.fmt(x.amount_minor)}</div></div>)}</div> : <Empty title="No budgets" />}</CardBody></Card>
          <Card><CardHeader title="Debt balances" /><CardBody><Table head={['Debt', 'Type', 'Outstanding']} rows={d.debts.map((x) => [x.counterparty, x.direction === 'payable' ? 'I owe' : 'Owed to me', money.fmt(x.outstanding_minor)])} /></CardBody></Card>
          <Card><CardHeader title="Savings progress" /><CardBody><Table head={['Goal', 'Saved', 'Target', '%']} rows={d.goals.map((g) => [g.name, money.fmt(d.gp[g.id] ?? 0), money.fmt(g.target_minor), (((d.gp[g.id] ?? 0) / g.target_minor) * 100).toFixed(0) + '%'])} /></CardBody></Card>
        </Section>
        <Section title="Comparisons">
          <Card><CardHeader title="Month over month" /><CardBody><Table head={['', 'This month', 'Last month', 'Change']} rows={[cmp('Income', a.income, b.income), cmp('Expenses', a.expense, b.expense), cmp('Net cash flow', a.net, b.net)]} /><p className="mt-2 text-xs text-muted-foreground">This month is month-to-date; last month is the full month.</p></CardBody></Card>
          <Card><CardHeader title={`Year over year: expenses ${yr} vs ${py}`} /><CardBody><Bars data={yoy} series={[{ key: yr, color: '#3b82f6' }, { key: py, color: '#94a3b8' }]} /></CardBody></Card>
        </Section>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Reports" desc="Analyse income, spending and your overall position." />
      <div className="space-y-3 no-print"><DateFilter value={filter} onChange={setFilter} tz={tz} />
        <div className="flex flex-wrap gap-2"><Select className="w-48" value={acc} onChange={(e) => setAcc(e.target.value)} aria-label="Account"><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          <Select className="w-48" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>{loading && d && <span className="self-center text-xs text-muted-foreground">Updating…</span>}</div></div>
      {body}
    </>
  );
}
