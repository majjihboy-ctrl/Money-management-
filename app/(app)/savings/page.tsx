'use client';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, PiggyBank, History } from 'lucide-react';
import { useApp, useLoad } from '@/components/app-provider';
import { useQuickAdd } from '@/components/quick-add';
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Progress, Select, Textarea, Stat } from '@/components/ui';
import { addDays, daysBetween, fmtDate, fmtDay, todayStr } from '@/lib/dates';
import { goalProgress } from '@/lib/queries';
import { inputValue } from '@/lib/money';
import { errMsg } from '@/lib/utils';
import type { Goal } from '@/lib/types';

type Entry = { id: string; goal_id: string; entry_type: string; amount_minor: number; occurred_at: string; note: string | null };
const stTone = { active: 'success', paused: 'warning', completed: 'info', archived: 'muted' } as const;

function GoalForm({ initial, onDone }: { initial?: Goal; onDone: () => void }) {
  const { sb, money, accounts } = useApp();
  const schema = useMemo(() => z.object({ name: z.string().trim().min(1, 'Enter a name').max(80), target: z.string().refine((v) => { const m = money.parse(v); return m !== null && m > 0; }, 'Enter an amount greater than 0'), target_date: z.string().optional(), priority: z.string(), description: z.string().max(500).optional(), linked: z.string().optional() }), [money]);
  type V = z.infer<typeof schema>;
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { name: initial?.name ?? '', target: initial ? inputValue(initial.target_minor, money.cur) : '', target_date: initial?.target_date ?? '', priority: initial?.priority ?? 'medium', description: initial?.description ?? '', linked: initial?.linked_account_id ?? '' } });
  const { errors, isSubmitting } = f.formState;
  async function submit(v: V) {
    const row = { name: v.name, target_minor: money.parse(v.target)!, target_date: v.target_date || null, priority: v.priority, description: v.description || null, linked_account_id: v.linked || null };
    const { error } = initial ? await sb.from('savings_goals').update(row).eq('id', initial.id) : await sb.from('savings_goals').insert(row);
    if (error) return void toast.error(errMsg(error)); toast.success('Goal saved'); onDone();
  }
  return (
    <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label="Goal name" error={errors.name?.message}><Input {...f.register('name')} placeholder="e.g. Emergency fund" /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label={`Target amount (${money.cur})`} error={errors.target?.message}><Input inputMode="decimal" {...f.register('target')} /></Field><Field label="Target date"><Input type="date" {...f.register('target_date')} /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Priority"><Select {...f.register('priority')}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select></Field>
        <Field label="Linked savings account" hint="Optional. Lets contributions move real money."><Select {...f.register('linked')}><option value="">None (earmark only)</option>{accounts.filter((a) => !a.archived_at).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field></div>
      <Field label="Description"><Textarea {...f.register('description')} /></Field>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={isSubmitting}>Save goal</Button></div>
    </form>
  );
}

export default function Savings() {
  const { sb, tz, money, refresh } = useApp(); const qa = useQuickAdd(); const today = todayStr(tz);
  const [edit, setEdit] = useState<Goal | 'new' | null>(null); const [hist, setHist] = useState<Goal | null>(null); const [show, setShow] = useState(false);
  const { data, loading, error } = useLoad(async () => {
    const [g, gp, e] = await Promise.all([sb.from('savings_goals').select('*').order('created_at'), goalProgress(sb), sb.from('savings_entries').select('*').order('occurred_at', { ascending: false })]);
    if (g.error) throw g.error; return { goals: (g.data ?? []) as Goal[], gp, entries: (e.data ?? []) as Entry[] };
  }, []);
  async function setStatus(g: Goal, status: string) { const { error } = await sb.from('savings_goals').update({ status }).eq('id', g.id); if (error) return void toast.error(errMsg(error)); toast.success(`Goal ${status}`); refresh(); }
  const eta = (g: Goal, cur: number, entries: Entry[]) => {
    if (cur >= g.target_minor) return 'Goal reached';
    const mine = entries.filter((e) => e.goal_id === g.id); if (mine.length < 2) return null;
    const first = mine[mine.length - 1].occurred_at.slice(0, 10); const span = Math.max(30, daysBetween(first, today));
    const perDay = cur / span; if (perDay <= 0) return null; return `Estimated completion ${fmtDay(addDays(today, Math.ceil((g.target_minor - cur) / perDay)), 'd MMM yyyy')} at your current pace`;
  };
  const visible = (data?.goals ?? []).filter((g) => show || g.status !== 'archived');
  const totalSaved = (data?.goals ?? []).filter((g) => g.status !== 'archived').reduce((s, g) => s + (data?.gp[g.id] ?? 0), 0);
  return (
    <>
      <PageHeader title="Savings goals" desc="Goals are earmarks of money you hold in your accounts, not extra money." actions={<><Button variant="outline" onClick={() => qa.open('savings')}><PiggyBank className="h-4 w-4" />Contribute</Button><Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />New goal</Button></>} />
      {loading && !data ? <Loading /> : error ? <Empty title="Could not load goals" hint={error} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3"><Stat label="Earmarked across goals" value={money.fmt(totalSaved)} sub="Not additional to your balances" /><Stat label="Active goals" value={String((data?.goals ?? []).filter((g) => g.status === 'active').length)} /></div>
          {!visible.length ? <Card><Empty title="No savings goals" hint="Create goals like an emergency fund, laptop or school fees." action={<Button onClick={() => setEdit('new')}>Create goal</Button>} /></Card> : (
            <div className="grid gap-4 md:grid-cols-2">{visible.map((g) => { const cur = data!.gp[g.id] ?? 0; const p = (cur / g.target_minor) * 100; const note = eta(g, cur, data!.entries); return (
              <Card key={g.id} className="p-4">
                <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{g.name}</div>{g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}</div><div className="flex gap-1"><Badge tone={g.priority === 'high' ? 'danger' : g.priority === 'medium' ? 'warning' : 'muted'}>{g.priority}</Badge><Badge tone={stTone[g.status]}>{g.status}</Badge></div></div>
                <div className="num mt-3 flex items-baseline justify-between"><span className="text-xl font-semibold">{money.fmt(cur)}</span><span className="text-sm text-muted-foreground">of {money.fmt(g.target_minor)}</span></div>
                <div className="mt-2"><Progress value={p} /></div>
                <div className="mt-1 text-xs text-muted-foreground">{p.toFixed(1)}% · {g.target_date ? `target ${fmtDay(g.target_date, 'd MMM yyyy')}` : 'no target date'}</div>
                {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {g.status === 'active' && <><Button size="sm" onClick={() => qa.open('savings', undefined, { goal: g.id })}>Contribute</Button><Button size="sm" variant="outline" onClick={() => qa.open('savings', undefined, { goal: g.id, type: 'withdrawal' })}>Withdraw</Button></>}
                  <Button size="sm" variant="ghost" onClick={() => setHist(g)}><History className="h-3.5 w-3.5" />History</Button>
                  <Button size="sm" variant="ghost" aria-label="Edit goal" onClick={() => setEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                  {g.status === 'active' && <Button size="sm" variant="ghost" onClick={() => setStatus(g, 'paused')}>Pause</Button>}
                  {g.status === 'paused' && <Button size="sm" variant="ghost" onClick={() => setStatus(g, 'active')}>Resume</Button>}
                  {(g.status === 'active' || g.status === 'paused') && <Button size="sm" variant="ghost" onClick={() => setStatus(g, 'completed')}>Complete</Button>}
                  {g.status !== 'archived' ? <Button size="sm" variant="ghost" onClick={() => setStatus(g, 'archived')}>Archive</Button> : <Button size="sm" variant="ghost" onClick={() => setStatus(g, 'active')}>Restore</Button>}
                </div>
              </Card>); })}</div>
          )}
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'} archived</Button>
        </>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New goal' : 'Edit goal'}>{edit && <GoalForm key={typeof edit === 'string' ? 'n' : edit.id} initial={edit === 'new' ? undefined : edit} onDone={() => { setEdit(null); refresh(); }} />}</Modal>
      <Modal open={!!hist} onClose={() => setHist(null)} title={`${hist?.name} · history`}>
        {(data?.entries ?? []).filter((e) => e.goal_id === hist?.id).length ? <ul className="divide-y divide-border">{(data?.entries ?? []).filter((e) => e.goal_id === hist?.id).map((e) => (
          <li key={e.id} className="flex justify-between py-2 text-sm"><div><div className="capitalize">{e.entry_type}</div><div className="text-xs text-muted-foreground">{fmtDate(e.occurred_at, tz, 'd MMM yyyy, HH:mm')}{e.note ? ` · ${e.note}` : ''}</div></div><span className={`num font-medium ${e.entry_type === 'contribution' ? 'text-success' : ''}`}>{e.entry_type === 'contribution' ? '+' : '−'}{money.fmt(e.amount_minor)}</span></li>))}</ul> : <Empty title="No contributions yet" />}
      </Modal>
    </>
  );
}
