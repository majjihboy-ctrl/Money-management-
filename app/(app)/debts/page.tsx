'use client';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, History } from 'lucide-react';
import { useApp, useLoad } from '@/components/app-provider';
import { useQuickAdd } from '@/components/quick-add';
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Progress, Select, Stat, Tabs, Textarea } from '@/components/ui';
import { addMonths, fmtDay, todayStr } from '@/lib/dates';
import { payoffMonths } from '@/lib/calc';
import { inputValue } from '@/lib/money';
import { errMsg } from '@/lib/utils';
import type { Debt } from '@/lib/types';

type Pay = { id: string; debt_id: string; principal_minor: number; interest_minor: number; fees_minor: number; paid_on: string; note: string | null; voided_at: string | null };
const FREQ = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'];

function DebtForm({ initial, direction, onDone }: { initial?: Debt; direction: 'payable' | 'receivable'; onDone: () => void }) {
  const { sb, money } = useApp(); const pay = direction === 'payable';
  const schema = useMemo(() => z.object({ who: z.string().trim().min(1, 'Required').max(120), original: z.string().refine((v) => (money.parse(v) ?? 0) > 0, 'Enter an amount greater than 0'), outstanding: z.string().refine((v) => money.parse(v) !== null, 'Invalid amount'), rate: z.string().refine((v) => !v || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 1000), 'Enter a percentage like 12.5'), min: z.string().refine((v) => !v || money.parse(v) !== null, 'Invalid amount'), freq: z.string(), start: z.string().optional(), due: z.string().optional(), notes: z.string().max(1000).optional() })
    .refine((v) => (money.parse(v.outstanding) ?? 0) <= (money.parse(v.original) ?? 0) || !!initial, { path: ['outstanding'], message: 'Cannot exceed the original amount' }), [money, initial]);
  type V = z.infer<typeof schema>;
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { who: initial?.counterparty ?? '', original: initial ? inputValue(initial.original_minor, money.cur) : '', outstanding: initial ? inputValue(initial.outstanding_minor, money.cur) : '', rate: initial?.interest_rate_bps != null ? String(initial.interest_rate_bps / 100) : '', min: initial?.min_payment_minor != null ? inputValue(initial.min_payment_minor, money.cur) : '', freq: initial?.payment_frequency ?? 'monthly', start: initial?.start_date ?? '', due: initial?.due_date ?? '', notes: initial?.notes ?? '' } });
  const { errors, isSubmitting } = f.formState;
  async function submit(v: V) {
    const orig = money.parse(v.original)!;
    const row = { direction, counterparty: v.who, original_minor: orig, outstanding_minor: v.outstanding === '' ? orig : money.parse(v.outstanding)!, interest_rate_bps: v.rate ? Math.round(Number(v.rate) * 100) : null, min_payment_minor: v.min ? money.parse(v.min) : null, payment_frequency: v.freq, start_date: v.start || null, due_date: v.due || null, notes: v.notes || null };
    const { error } = initial ? await sb.from('debts').update(row).eq('id', initial.id) : await sb.from('debts').insert(row);
    if (error) return void toast.error(errMsg(error)); toast.success('Saved'); onDone();
  }
  return (
    <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label={pay ? 'Creditor' : 'Borrower'} error={errors.who?.message}><Input {...f.register('who')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label={`Original amount (${money.cur})`} error={errors.original?.message}><Input inputMode="decimal" {...f.register('original')} /></Field><Field label="Outstanding" error={errors.outstanding?.message} hint="Leave empty to use the original amount."><Input inputMode="decimal" {...f.register('outstanding')} /></Field></div>
      {pay && <div className="grid gap-4 sm:grid-cols-3"><Field label="Interest rate (% p.a.)" error={errors.rate?.message}><Input inputMode="decimal" {...f.register('rate')} /></Field><Field label="Minimum payment" error={errors.min?.message}><Input inputMode="decimal" {...f.register('min')} /></Field><Field label="Frequency"><Select {...f.register('freq')}>{FREQ.map((x) => <option key={x}>{x}</option>)}</Select></Field></div>}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Start date"><Input type="date" {...f.register('start')} /></Field><Field label={pay ? 'Next due date' : 'Expected repayment date'}><Input type="date" {...f.register('due')} /></Field></div>
      <Field label="Notes"><Textarea {...f.register('notes')} /></Field>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={isSubmitting}>Save</Button></div>
    </form>
  );
}

export default function Debts() {
  const { sb, tz, money, refresh } = useApp(); const qa = useQuickAdd(); const today = todayStr(tz);
  const [tab, setTab] = useState<'payable' | 'receivable'>('payable'); const [strategy, setStrategy] = useState('smallest');
  const [edit, setEdit] = useState<Debt | 'new' | null>(null); const [hist, setHist] = useState<Debt | null>(null);
  const { data, loading, error } = useLoad(async () => {
    const [d, p] = await Promise.all([sb.from('debts').select('*').order('created_at'), sb.from('debt_payments').select('*').is('voided_at', null).order('paid_on', { ascending: false })]);
    if (d.error) throw d.error; return { debts: (d.data ?? []) as Debt[], pays: (p.data ?? []) as Pay[] };
  }, []);
  const list = (data?.debts ?? []).filter((d) => d.direction === tab && d.status !== 'archived');
  const active = list.filter((d) => d.status === 'active');
  const ordered = useMemo(() => [...active].sort((a, b) => strategy === 'smallest' ? a.outstanding_minor - b.outstanding_minor : strategy === 'interest' ? (b.interest_rate_bps ?? 0) - (a.interest_rate_bps ?? 0) : a.priority - b.priority), [active, strategy]);
  const total = active.reduce((s, d) => s + d.outstanding_minor, 0), orig = list.reduce((s, d) => s + d.original_minor, 0);
  async function archive(d: Debt) { const { error } = await sb.from('debts').update({ status: 'archived' }).eq('id', d.id); if (error) return void toast.error(errMsg(error)); refresh(); }
  async function prio(d: Debt, v: string) { const n = parseInt(v, 10); if (isNaN(n)) return; const { error } = await sb.from('debts').update({ priority: n }).eq('id', d.id); if (error) toast.error(errMsg(error)); else refresh(); }
  return (
    <>
      <PageHeader title="Debts & loans" desc="Track what you owe and what is owed to you." actions={<><Button variant="outline" onClick={() => qa.open('debt')}>Record payment</Button><Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />Add {tab === 'payable' ? 'debt' : 'loan given'}</Button></>} />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ id: 'payable', label: 'I owe' }, { id: 'receivable', label: 'Owed to me' }]} /></div>
      {loading && !data ? <Loading /> : error ? <Empty title="Could not load debts" hint={error} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3"><Stat label="Outstanding" value={money.fmt(total)} tone={tab === 'payable' ? 'danger' : 'success'} /><Stat label="Repaid so far" value={orig ? `${(((orig - list.reduce((s, d) => s + d.outstanding_minor, 0)) / orig) * 100).toFixed(0)}%` : '—'} sub={`of ${money.fmt(orig)} originally`} /></div>
          {tab === 'payable' && active.length > 1 && <Card className="mb-4 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-semibold">Repayment strategy</div><div className="text-xs text-muted-foreground">Pay minimums on all, then put extra money on the first debt below.</div></div><Select className="w-52" value={strategy} onChange={(e) => setStrategy(e.target.value)} aria-label="Strategy"><option value="smallest">Smallest balance first</option><option value="interest">Highest interest first</option><option value="custom">Custom priority</option></Select></div><ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">{ordered.map((d) => <li key={d.id}>{d.counterparty} <span className="num text-muted-foreground">— {money.fmt(d.outstanding_minor)}{d.interest_rate_bps ? ` · ${(d.interest_rate_bps / 100).toFixed(2)}%` : ''}</span></li>)}</ol></Card>}
          {!list.length ? <Card><Empty title={tab === 'payable' ? 'No debts recorded' : 'No loans recorded'} hint="Add one to track balances and repayments." /></Card> : (
            <div className="grid gap-4 md:grid-cols-2">{list.map((d) => { const done = ((d.original_minor - d.outstanding_minor) / d.original_minor) * 100; const months = payoffMonths(d.outstanding_minor, d.interest_rate_bps, d.min_payment_minor); const overdue = d.status === 'active' && d.due_date && d.due_date < today; return (
              <Card key={d.id} className="p-4">
                <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{d.counterparty}</div><div className="text-xs text-muted-foreground">{d.due_date ? `${overdue ? 'Overdue · ' : 'Due '}${fmtDay(d.due_date, 'd MMM yyyy')}` : 'No due date'}{d.interest_rate_bps ? ` · ${(d.interest_rate_bps / 100).toFixed(2)}% p.a.` : ''}</div></div><Badge tone={d.status === 'paid' ? 'success' : overdue ? 'danger' : 'muted'}>{d.status === 'paid' ? 'Paid off' : overdue ? 'Overdue' : 'Active'}</Badge></div>
                <div className="num mt-3 flex items-baseline justify-between"><span className="text-xl font-semibold">{money.fmt(d.outstanding_minor)}</span><span className="text-sm text-muted-foreground">of {money.fmt(d.original_minor)}</span></div>
                <div className="mt-2"><Progress value={done} /></div><div className="mt-1 text-xs text-muted-foreground">{done.toFixed(0)}% repaid{d.min_payment_minor ? ` · min ${money.fmt(d.min_payment_minor)} ${d.payment_frequency ?? ''}` : ''}</div>
                {months !== null && d.status === 'active' && <div className="mt-1 text-xs text-muted-foreground">Estimated payoff {fmtDay(addMonths(today, months), 'MMM yyyy')} at the minimum payment (estimate)</div>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {d.status === 'active' && <Button size="sm" onClick={() => qa.open('debt', undefined, { debt: d.id })}>{tab === 'payable' ? 'Pay' : 'Record repayment'}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setHist(d)}><History className="h-3.5 w-3.5" />History</Button>
                  <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                  {d.status === 'paid' && <Button size="sm" variant="ghost" onClick={() => archive(d)}>Archive</Button>}
                  {tab === 'payable' && strategy === 'custom' && d.status === 'active' && <label className="ml-auto flex items-center gap-1 text-xs">Priority<Input className="h-8 w-16" type="number" defaultValue={d.priority} onBlur={(e) => prio(d, e.target.value)} /></label>}
                </div>
              </Card>); })}</div>
          )}
        </>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Add' : 'Edit'}>{edit && <DebtForm key={typeof edit === 'string' ? 'n' : edit.id} initial={edit === 'new' ? undefined : edit} direction={tab} onDone={() => { setEdit(null); refresh(); }} />}</Modal>
      <Modal open={!!hist} onClose={() => setHist(null)} title={`${hist?.counterparty} · payments`}>
        {(data?.pays ?? []).filter((p) => p.debt_id === hist?.id).length ? <ul className="divide-y divide-border">{(data?.pays ?? []).filter((p) => p.debt_id === hist?.id).map((p) => (
          <li key={p.id} className="py-2 text-sm"><div className="flex justify-between"><span>{fmtDay(p.paid_on, 'd MMM yyyy')}</span><span className="num font-medium">{money.fmt(p.principal_minor + p.interest_minor + p.fees_minor)}</span></div><div className="num text-xs text-muted-foreground">Principal {money.fmt(p.principal_minor)} · Interest {money.fmt(p.interest_minor)} · Fees {money.fmt(p.fees_minor)}{p.note ? ` · ${p.note}` : ''}</div></li>))}</ul> : <Empty title="No payments yet" />}
      </Modal>
    </>
  );
}
