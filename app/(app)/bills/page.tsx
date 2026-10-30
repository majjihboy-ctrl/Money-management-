'use client';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Check, SkipForward, Pause, Play, Trash2 } from 'lucide-react';
import { useApp, useLoad } from '@/components/app-provider';
import { Badge, Button, Card, CardHeader, Confirm, Empty, Field, Input, Loading, Modal, PageHeader, Select, Toggle } from '@/components/ui';
import { addDays, fmtDay, todayStr } from '@/lib/dates';
import { inputValue } from '@/lib/money';
import { errMsg, cn } from '@/lib/utils';
import type { Occurrence, Rule } from '@/lib/types';

const FREQS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['biweekly', 'Every two weeks'], ['monthly', 'Monthly'], ['quarterly', 'Every three months'], ['annual', 'Annually'], ['custom', 'Custom (every N days)']];

function RuleForm({ initial, onDone }: { initial?: Rule; onDone: () => void }) {
  const { sb, money, accounts, categories, profile, tz } = useApp();
  const schema = useMemo(() => z.object({ name: z.string().trim().min(1, 'Enter a name').max(80), kind: z.enum(['income', 'expense']), amount: z.string().refine((v) => (money.parse(v) ?? 0) > 0, 'Enter an amount greater than 0'), category_id: z.string().optional(), account_id: z.string().min(1, 'Choose an account'), counterparty: z.string().max(120).optional(), frequency: z.string(), interval: z.coerce.number().int().min(1).max(365), start: z.string().min(1, 'Required'), end: z.string().optional(), essential: z.boolean() })
    .refine((v) => !v.end || v.end >= v.start, { path: ['end'], message: 'End must be on or after start' }), [money]);
  type V = z.infer<typeof schema>;
  const f = useForm({ resolver: zodResolver(schema), defaultValues: { name: initial?.name ?? '', kind: initial?.kind ?? 'expense', amount: initial ? inputValue(initial.amount_minor, money.cur) : '', category_id: initial?.category_id ?? '', account_id: initial?.account_id ?? profile.default_account_id ?? '', counterparty: initial?.counterparty ?? '', frequency: initial?.frequency ?? 'monthly', interval: initial?.interval_count ?? 1, start: initial?.start_date ?? todayStr(tz), end: initial?.end_date ?? '', essential: initial?.is_essential ?? true } });
  const { errors, isSubmitting } = f.formState; const kind = f.watch('kind');
  async function submit(v: unknown) {
    const x = v as V;
    const row = { name: x.name, kind: x.kind, amount_minor: money.parse(x.amount)!, category_id: x.category_id || null, account_id: x.account_id, counterparty: x.counterparty || null, frequency: x.frequency, interval_count: x.frequency === 'custom' ? x.interval : 1, start_date: x.start, end_date: x.end || null, is_essential: x.essential };
    const { error } = initial ? await sb.from('recurring_rules').update(row).eq('id', initial.id) : await sb.from('recurring_rules').insert(row);
    if (error) return void toast.error(errMsg(error)); toast.success('Saved'); onDone();
  }
  return (
    <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label="Name" error={errors.name?.message}><Input {...f.register('name')} placeholder="e.g. Rent, Salary, Netflix" /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Type"><Select {...f.register('kind')}><option value="expense">Expense / bill</option><option value="income">Income</option></Select></Field><Field label={`Amount (${money.cur})`} error={errors.amount?.message}><Input inputMode="decimal" {...f.register('amount')} /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Category"><Select {...f.register('category_id')}><option value="">Uncategorised</option>{categories.filter((c) => c.kind === kind && !c.archived_at).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field><Field label="Account" error={errors.account_id?.message}><Select {...f.register('account_id')}><option value="">Select…</option>{accounts.filter((a) => !a.archived_at).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Frequency"><Select {...f.register('frequency')}>{FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>{f.watch('frequency') === 'custom' ? <Field label="Every N days" error={errors.interval?.message}><Input type="number" min={1} {...f.register('interval')} /></Field> : <Field label={kind === 'income' ? 'Source' : 'Merchant'}><Input {...f.register('counterparty')} /></Field>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Start date (first due date)" error={errors.start?.message}><Input type="date" {...f.register('start')} /></Field><Field label="End date (optional)" error={errors.end?.message}><Input type="date" {...f.register('end')} /></Field></div>
      {kind === 'expense' && <Toggle label="Essential expense" checked={f.watch('essential')} onChange={(v) => f.setValue('essential', v)} />}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={isSubmitting}>Save</Button></div>
    </form>
  );
}

export default function Bills() {
  const { sb, tz, money, accounts, refresh } = useApp(); const today = todayStr(tz);
  const [edit, setEdit] = useState<Rule | 'new' | null>(null); const [del, setDel] = useState<Rule | null>(null); const [busy, setBusy] = useState('');
  const { data, loading, error } = useLoad(async () => {
    await sb.rpc('generate_occurrences', { p_until: addDays(today, 60) });
    const [r, o] = await Promise.all([sb.from('recurring_rules').select('*').order('name'), sb.from('recurring_occurrences').select('*').eq('state', 'pending').order('due_date')]);
    if (r.error) throw r.error; return { rules: (r.data ?? []) as Rule[], occ: (o.data ?? []) as Occurrence[] };
  }, []);
  const rm = new Map((data?.rules ?? []).map((r) => [r.id, r]));
  const due = (data?.occ ?? []).filter((o) => rm.get(o.rule_id)?.is_active).filter((o) => o.due_date <= addDays(today, 30));
  async function pay(o: Occurrence) { setBusy(o.id); const { error } = await sb.rpc('post_occurrence', { p_occurrence: o.id }); setBusy(''); if (error) return void toast.error(errMsg(error)); toast.success('Posted. It will not be charged twice.'); refresh(); }
  async function skip(o: Occurrence) { const { error } = await sb.from('recurring_occurrences').update({ state: 'skipped' }).eq('id', o.id); if (error) return void toast.error(errMsg(error)); refresh(); }
  async function toggle(r: Rule) { const { error } = await sb.from('recurring_rules').update({ is_active: !r.is_active }).eq('id', r.id); if (error) return void toast.error(errMsg(error)); refresh(); }
  async function remove() { if (!del) return; const { error } = await sb.from('recurring_rules').delete().eq('id', del.id); if (error) return void toast.error(error.code === '23503' ? 'This item has posted transactions. Pause it instead.' : errMsg(error)); toast.success('Deleted'); setDel(null); refresh(); }
  return (
    <>
      <PageHeader title="Bills & recurring" desc="Nothing is charged automatically. Review what is due and mark it as paid." actions={<Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />New recurring item</Button>} />
      {loading && !data ? <Loading /> : error ? <Empty title="Could not load bills" hint={error} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader title="Due in the next 30 days" />
            {!due.length ? <Empty title="Nothing due" hint="Create a recurring item to see upcoming bills and income here." /> : <ul className="divide-y divide-border">{due.map((o) => { const r = rm.get(o.rule_id)!; const late = o.due_date < today; return (
              <li key={o.id} className="flex items-center gap-3 px-4 py-3 text-sm"><div className="min-w-0 flex-1"><div className="truncate font-medium">{r.name}</div><div className={cn('text-xs', late ? 'text-destructive' : 'text-muted-foreground')}>{late ? 'Overdue · ' : o.due_date === today ? 'Due today · ' : ''}{fmtDay(o.due_date, 'EEE d MMM')} · {accounts.find((a) => a.id === r.account_id)?.name}</div></div>
                <span className={cn('num font-semibold', r.kind === 'income' && 'text-success')}>{r.kind === 'income' ? '+' : ''}{money.fmt(r.amount_minor)}</span>
                <Button size="sm" loading={busy === o.id} onClick={() => pay(o)}><Check className="h-3.5 w-3.5" />{r.kind === 'income' ? 'Received' : 'Paid'}</Button>
                <Button size="icon" variant="ghost" aria-label="Skip" onClick={() => skip(o)}><SkipForward className="h-4 w-4" /></Button></li>); })}</ul>}
          </Card>
          <Card><CardHeader title="Recurring items" />
            {!data?.rules.length ? <Empty title="None yet" /> : <ul className="divide-y divide-border">{data.rules.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-4 py-3 text-sm"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate font-medium">{r.name}</span><Badge tone={r.is_active ? 'success' : 'muted'}>{r.is_active ? 'Active' : 'Paused'}</Badge></div><div className="text-xs text-muted-foreground">{FREQS.find((f) => f[0] === r.frequency)?.[1]}{r.frequency === 'custom' ? ` (${r.interval_count}d)` : ''} · next {r.next_due_date ? fmtDay(r.next_due_date, 'd MMM') : '—'}</div></div>
                <span className="num">{money.fmt(r.amount_minor)}</span>
                <Button size="icon" variant="ghost" aria-label={r.is_active ? 'Pause' : 'Resume'} onClick={() => toggle(r)}>{r.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDel(r)}><Trash2 className="h-4 w-4" /></Button></li>))}</ul>}
          </Card>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New recurring item' : 'Edit recurring item'}>{edit && <RuleForm key={typeof edit === 'string' ? 'n' : edit.id} initial={edit === 'new' ? undefined : edit} onDone={() => { setEdit(null); refresh(); }} />}</Modal>
      <Confirm open={!!del} title="Delete recurring item?" desc="Pending occurrences are removed. Transactions already posted are kept." onConfirm={remove} onCancel={() => setDel(null)} />
    </>
  );
}
