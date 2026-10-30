'use client';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp, useLoad } from '@/components/app-provider';
import { Bars } from '@/components/charts';
import { Badge, Button, Card, CardBody, CardHeader, Confirm, Empty, Field, Input, Loading, Modal, PageHeader, Progress, Select } from '@/components/ui';
import { addDays, endOfMonth, endOfYear, fmtDay, startOfMonth, startOfWeek, startOfYear, todayStr } from '@/lib/dates';
import { loadBudgets } from '@/lib/queries';
import { inputValue } from '@/lib/money';
import { errMsg } from '@/lib/utils';
import type { BudgetView } from '@/lib/types';

const bounds = (p: string, a: string) => p === 'daily' ? [a, a] : p === 'weekly' ? [startOfWeek(a), addDays(startOfWeek(a), 6)] : p === 'monthly' ? [startOfMonth(a), endOfMonth(a)] : [startOfYear(a), endOfYear(a)];
const tone = (s: string) => (s === 'Exceeded' ? 'danger' : s === 'On Track' ? 'success' : 'warning') as 'danger' | 'success' | 'warning';

export default function Budgets() {
  const { sb, tz, money, categories, profile, refresh } = useApp();
  const [edit, setEdit] = useState<BudgetView | 'new' | null>(null); const [del, setDel] = useState<BudgetView | null>(null);
  const { data, loading, error } = useLoad(() => loadBudgets(sb, tz), []);
  async function remove() { if (!del) return; const { error } = await sb.from('budgets').delete().eq('id', del.id); if (error) return void toast.error(errMsg(error)); toast.success('Budget deleted. Your transactions are untouched.'); setDel(null); refresh(); }
  const chart = (data ?? []).map((b) => ({ label: b.name, Budget: money.major(b.amount_minor), Actual: money.major(b.spent) }));
  return (
    <>
      <PageHeader title="Budgets" desc="Set limits and see how you are tracking." actions={<Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />New budget</Button>} />
      {loading && !data ? <Loading /> : error ? <Empty title="Could not load budgets" hint={error} /> : !data?.length ? <Card><Empty title="No budgets yet" hint="Create a daily, weekly, monthly, annual or custom budget, overall or per category." action={<Button onClick={() => setEdit('new')}>Create budget</Button>} /></Card> : (
        <div className="space-y-4">
          <Card><CardHeader title="Budget vs actual" /><CardBody><Bars data={chart} series={[{ key: 'Budget', color: '#3b82f6' }, { key: 'Actual', color: '#f59e0b' }]} /></CardBody></Card>
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{b.name}</div><div className="text-xs text-muted-foreground">{b.period} · {fmtDay(b.start_date, 'd MMM yyyy')} – {fmtDay(b.end_date, 'd MMM yyyy')}{b.category_id ? ` · ${categories.find((c) => c.id === b.category_id)?.name}` : ' · All expenses'}</div></div><Badge tone={tone(b.status)}>{b.status}</Badge></div>
                <div className="mt-3"><Progress value={b.pct} tone={b.pct >= 100 ? 'danger' : b.pct >= (b.thresholds[0] ?? 75) ? 'warning' : 'success'} /></div>
                <div className="num mt-2 grid grid-cols-3 gap-2 text-sm"><div><div className="text-xs text-muted-foreground">Budget</div>{money.fmt(b.amount_minor)}</div><div><div className="text-xs text-muted-foreground">Spent</div>{money.fmt(b.spent)}</div><div><div className="text-xs text-muted-foreground">Remaining</div><span className={b.spent > b.amount_minor ? 'text-destructive' : ''}>{money.fmt(b.amount_minor - b.spent)}</span></div></div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{b.pct.toFixed(0)}% used · alerts at {b.thresholds.join('%, ')}%</span><span><Button variant="ghost" size="icon" aria-label="Edit budget" onClick={() => setEdit(b)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Delete budget" onClick={() => setDel(b)}><Trash2 className="h-4 w-4" /></Button></span></div>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Overlapping budgets each measure the same transactions independently; dashboard and report totals are always computed from transactions, so nothing is double-counted.</p>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New budget' : 'Edit budget'}>{edit && <BudgetForm key={typeof edit === 'string' ? 'n' : edit.id} initial={edit === 'new' ? undefined : edit} onDone={() => { setEdit(null); refresh(); }} />}</Modal>
      <Confirm open={!!del} title="Delete budget?" desc="Only the budget is removed. Your transactions and history are not affected." onConfirm={remove} onCancel={() => setDel(null)} />
    </>
  );
}

function BudgetForm({ initial, onDone }: { initial?: BudgetView; onDone: () => void }) {
  const { sb, tz, money, categories, profile } = useApp();
  const today = todayStr(tz);
  const schema = useMemo(() => z.object({
    name: z.string().min(1, 'Enter a name').max(80), period: z.string(), category_id: z.string().optional(),
    amount: z.string().refine((v) => { const m = money.parse(v); return m !== null && m > 0; }, 'Enter an amount greater than 0'),
    anchor: z.string().min(1), start: z.string().optional(), end: z.string().optional(), thresholds: z.string().regex(/^\s*\d{1,3}(\s*,\s*\d{1,3}){0,2}\s*$/, 'Use up to three percentages, e.g. 75, 90, 100'),
  }).refine((v) => v.period !== 'custom' || (v.start && v.end && v.end >= v.start), { path: ['end'], message: 'End date must be on or after start date' }), []);
  type V = z.infer<typeof schema>;
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { name: initial?.name ?? '', period: initial?.period ?? profile.default_budget_period ?? 'monthly', category_id: initial?.category_id ?? '', amount: initial ? inputValue(initial.amount_minor, money.cur) : '', anchor: initial?.start_date ?? today, start: initial?.start_date ?? today, end: initial?.end_date ?? today, thresholds: (initial?.thresholds ?? profile.warning_thresholds ?? [75, 90, 100]).join(', ') } });
  const { errors, isSubmitting } = f.formState; const period = f.watch('period');
  async function submit(v: V) {
    const [s, e] = v.period === 'custom' ? [v.start!, v.end!] : bounds(v.period, v.anchor);
    const row = { name: v.name, period: v.period, category_id: v.category_id || null, amount_minor: money.parse(v.amount)!, start_date: s, end_date: e, thresholds: v.thresholds.split(',').map((x) => Math.min(200, Math.max(1, Number(x.trim())))).sort((a, b) => a - b) };
    const { error } = initial ? await sb.from('budgets').update(row).eq('id', initial.id) : await sb.from('budgets').insert(row);
    if (error) return void toast.error(errMsg(error)); toast.success('Budget saved'); onDone();
  }
  return (
    <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label="Name" error={errors.name?.message}><Input {...f.register('name')} placeholder="e.g. Monthly food" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Period"><Select {...f.register('period')}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom range</option></Select></Field>
        <Field label={`Amount (${money.cur})`} error={errors.amount?.message}><Input inputMode="decimal" {...f.register('amount')} /></Field>
      </div>
      <Field label="Category" hint="Leave as All expenses for an overall budget."><Select {...f.register('category_id')}><option value="">All expenses</option>{categories.filter((c) => c.kind === 'expense' && !c.archived_at).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      {period === 'custom' ? <div className="grid gap-4 sm:grid-cols-2"><Field label="Start"><Input type="date" {...f.register('start')} /></Field><Field label="End" error={errors.end?.message}><Input type="date" {...f.register('end')} /></Field></div>
        : <Field label="Period containing" hint="The budget covers the whole calendar period around this date."><Input type="date" {...f.register('anchor')} /></Field>}
      <Field label="Warning thresholds (%)" error={errors.thresholds?.message}><Input {...f.register('thresholds')} /></Field>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={isSubmitting}>Save budget</Button></div>
    </form>
  );
}
