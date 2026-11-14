'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, PiggyBank, Landmark, Paperclip, Trash2, ChevronDown } from 'lucide-react';
import { useApp } from './app-provider';
import { Button, Field, Input, Modal, Select, Textarea, Toggle } from './ui';
import { errMsg, uuid } from '@/lib/utils';
import { fromLocalInput, nowLocalInput, toLocalInput, todayStr } from '@/lib/dates';
import { inputValue } from '@/lib/money';
import { enqueue, isNetworkError } from '@/lib/offline';
import type { Debt, Goal, Txn } from '@/lib/types';
import { cn } from '@/lib/utils';

export type Mode = 'income' | 'expense' | 'transfer' | 'savings' | 'debt' | 'deposit' | 'withdrawal';
type Ctx = { open: (m: Mode, initial?: Txn, preset?: Record<string, string>) => void; toggle: () => void; menuOpen: boolean };
const QA = createContext<Ctx>({ open: () => {}, toggle: () => {}, menuOpen: false });
export const useQuickAdd = () => useContext(QA);
export const METHODS = ['Cash', 'M-Pesa', 'Airtel Money', 'Bank Transfer', 'Card', 'Cheque', 'Other'];
const TITLES: Record<Mode, string> = { income: 'Add income', expense: 'Add expense', transfer: 'Transfer money', savings: 'Savings contribution', debt: 'Record debt payment', deposit: 'Record deposit', withdrawal: 'Record withdrawal' };
const MENU: { mode: Mode; label: string; icon: React.ReactNode; tone: string }[] = [
  { mode: 'expense', label: 'Expense', icon: <ArrowUpRight className="h-5 w-5" />, tone: 'bg-destructive/15 text-destructive' },
  { mode: 'income', label: 'Income', icon: <ArrowDownLeft className="h-5 w-5" />, tone: 'bg-success/15 text-success' },
  { mode: 'transfer', label: 'Transfer', icon: <ArrowLeftRight className="h-5 w-5" />, tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  { mode: 'savings', label: 'Savings', icon: <PiggyBank className="h-5 w-5" />, tone: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  { mode: 'debt', label: 'Debt payment', icon: <Landmark className="h-5 w-5" />, tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
];

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ mode: Mode; initial?: Txn; preset?: Record<string, string>; k: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const open = useCallback((mode: Mode, initial?: Txn, preset?: Record<string, string>) => { setMenu(false); setState({ mode, initial, preset, k: Date.now() }); }, []);
  const close = useCallback(() => setState(null), []);
  return (
    <QA.Provider value={{ open, toggle: () => setMenu((v) => !v), menuOpen: menu }}>
      {children}
      {menu && <div className="anim-fade fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={() => setMenu(false)} aria-hidden />}
      {menu && (
        <div role="menu" aria-label="Add" className="anim-sheet no-print fixed inset-x-4 bottom-24 z-50 grid grid-cols-2 gap-2 rounded-3xl border border-border bg-card p-3 shadow-xl md:inset-x-auto md:right-6 md:w-80">
          {MENU.map((m) => (
            <button key={m.mode} role="menuitem" onClick={() => open(m.mode)} className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-border/70 bg-background px-3 text-left text-sm font-medium active:scale-[0.98] hover:bg-muted">
              <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full', m.tone)}>{m.icon}</span>{m.label}
            </button>))}
        </div>
      )}
      <div className="no-print fixed bottom-6 right-6 z-50 hidden md:block">
        <Button size="icon" className="h-14 w-14 rounded-full shadow-fab" onClick={() => setMenu((v) => !v)} aria-label="Add transaction" aria-expanded={menu}><Plus className={cn('h-6 w-6 transition-transform', menu && 'rotate-45')} /></Button>
      </div>
      <Modal open={!!state} onClose={close} title={state ? (state.initial ? 'Edit ' + state.mode : TITLES[state.mode]) : ''} wide={state?.mode === 'expense'}>
        {state && (state.mode === 'income' || state.mode === 'expense' || state.mode === 'deposit' || state.mode === 'withdrawal'
          ? <TxnForm key={state.k} kind={state.mode} initial={state.initial} preset={state.preset} onDone={close} />
          : state.mode === 'transfer' ? <TransferForm key={state.k} preset={state.preset} onDone={close} />
          : state.mode === 'savings' ? <SavingsForm key={state.k} preset={state.preset} onDone={close} />
          : <DebtForm key={state.k} preset={state.preset} onDone={close} />)}
      </Modal>
    </QA.Provider>
  );
}

function Actions({ busy, label, onCancel }: { busy: boolean; label: string; onCancel: () => void }) {
  return <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-border bg-card px-5 py-3"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" loading={busy}>{label}</Button></div>;
}
const dateOk = (v: string) => { const t = Date.parse(v); return !isNaN(t) && Math.abs(t - Date.now()) < 5 * 365 * 864e5; };

function TxnForm({ kind, initial, preset, onDone }: { kind: 'income' | 'expense' | 'deposit' | 'withdrawal'; initial?: Txn; preset?: Record<string, string>; onDone: () => void }) {
  const { sb, user, accounts, categories, profile, money, tz, refresh } = useApp();
  const id = useRef(initial?.id ?? uuid()).current;
  const [file, setFile] = useState<File | null>(null);
  const [existing, setExisting] = useState<{ id: string; file_name: string; storage_path: string }[]>([]);
  const cats = categories.filter((c) => c.kind === kind && !c.archived_at);
  const accs = accounts.filter((a) => !a.archived_at);
  const isTxn = kind === 'income' || kind === 'expense';
  const schema = useMemo(() => z.object({
    amount: z.string().refine((v) => { const m = money.parse(v); return m !== null && m > 0; }, 'Enter a valid amount greater than 0'),
    occurred_at: z.string().refine(dateOk, 'Enter a valid date'),
    account_id: z.string().min(1, 'Choose an account'),
    category_id: z.string().optional(), counterparty: z.string().max(120).optional(), payment_method: z.string().max(40).optional(),
    description: z.string().max(300).optional(), notes: z.string().max(2000).optional(),
    is_essential: z.boolean(), is_recurring: z.boolean(), split: z.boolean(),
    splits: z.array(z.object({ category_id: z.string(), amount: z.string() })),
  }).superRefine((v, ctx) => {
    if (!v.split) return;
    const total = money.parse(v.amount) ?? 0; let sum = 0;
    v.splits.forEach((s, i) => { const m = money.parse(s.amount); if (!s.category_id) ctx.addIssue({ code: 'custom', path: ['splits', i, 'category_id'], message: 'Pick a category' }); if (m === null || m <= 0) ctx.addIssue({ code: 'custom', path: ['splits', i, 'amount'], message: 'Invalid amount' }); else sum += m; });
    if (v.splits.length < 2) ctx.addIssue({ code: 'custom', path: ['splits'], message: 'Add at least two split rows' });
    else if (sum !== total) ctx.addIssue({ code: 'custom', path: ['splits'], message: `Splits total ${money.fmt(sum)} but amount is ${money.fmt(total)}` });
  }), [money]);
  type V = z.infer<typeof schema>;
  const f = useForm<V>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: initial ? inputValue(initial.amount_minor, money.cur) : preset?.amount ?? '', occurred_at: initial ? toLocalInput(initial.occurred_at, tz) : nowLocalInput(tz),
      account_id: initial?.account_id ?? preset?.account_id ?? profile.default_account_id ?? accs[0]?.id ?? '', category_id: initial?.category_id ?? '',
      counterparty: initial?.counterparty ?? '', payment_method: initial?.payment_method ?? '', description: initial?.description ?? '', notes: initial?.notes ?? '',
      is_essential: initial?.is_essential ?? true, is_recurring: initial?.is_recurring ?? false,
      split: !!initial?.transaction_splits?.length,
      splits: initial?.transaction_splits?.length ? initial.transaction_splits.map((s) => ({ category_id: s.category_id, amount: inputValue(s.amount_minor, money.cur) })) : [{ category_id: '', amount: '' }, { category_id: '', amount: '' }],
    },
  });
  const arr = useFieldArray({ control: f.control, name: 'splits' });
  const [more, setMore] = useState(!!initial || !isTxn);
  const [showAll, setShowAll] = useState(false);
  const [usage, setUsage] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!isTxn) return; let live = true;
    sb.from('transactions').select('category_id').eq('kind', kind).is('voided_at', null).order('occurred_at', { ascending: false }).limit(300)
      .then(({ data }) => { if (!live || !data) return; const u: Record<string, number> = {}; for (const r of data as { category_id: string | null }[]) if (r.category_id) u[r.category_id] = (u[r.category_id] ?? 0) + 1; setUsage(u); });
    return () => { live = false; };
  }, [sb, kind, isTxn]);
  const sorted = [...cats].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.name.localeCompare(b.name));
  const chips = showAll ? sorted : sorted.slice(0, 8);
  const catVal = f.watch('category_id');
  const { errors, isSubmitting } = f.formState;
  const split = f.watch('split');
  useMemo(() => { if (initial) sb.from('attachments').select('id,file_name,storage_path').eq('transaction_id', initial.id).then(({ data }) => setExisting(data ?? [])); }, [initial, sb]);

  async function submit(v: V) {
    try {
      const minor = money.parse(v.amount)!;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error('Receipt must be 5 MB or smaller');
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) throw new Error('Receipt must be JPG, PNG, WebP or PDF');
      }
      const payload = { id, kind, account_id: v.account_id, amount_minor: minor, occurred_at: fromLocalInput(v.occurred_at, tz), category_id: isTxn ? v.category_id || null : null,
        counterparty: v.counterparty, description: v.description, notes: v.notes, payment_method: v.payment_method, is_essential: v.is_essential, is_recurring: v.is_recurring };
      const splits = kind === 'expense' && v.split ? v.splits.map((s) => ({ category_id: s.category_id, amount_minor: money.parse(s.amount)! })) : [];
      let queued = false;
      try {
        if (!initial && typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('offline');
        const { error } = await sb.rpc('save_transaction', { p: payload, p_splits: splits });
        if (error) throw error;
      } catch (e) {
        if (initial || !isNetworkError(e)) throw e;
        enqueue({ p: payload, splits }); queued = true;
      }
      if (queued) { toast.success(file ? 'Saved on this phone. It will sync when you are online (the receipt was not attached).' : 'Saved on this phone. It will sync when you are back online.'); onDone(); return; }
      if (file) {
        const path = `${user.id}/${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_').slice(0, 80)}`;
        const up = await sb.storage.from('receipts').upload(path, file, { contentType: file.type });
        if (up.error) toast.error('Saved, but the receipt upload failed: ' + up.error.message);
        else await sb.from('attachments').insert({ transaction_id: id, storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size });
      }
      toast.success(initial ? 'Transaction updated' : `${kind[0].toUpperCase() + kind.slice(1)} recorded`);
      refresh(); onDone();
    } catch (e) { toast.error(errMsg(e)); }
  }
  async function viewAtt(p: string) { const { data } = await sb.storage.from('receipts').createSignedUrl(p, 60); if (data) window.open(data.signedUrl, '_blank', 'noopener'); }
  async function delAtt(a: { id: string; storage_path: string }) { await sb.storage.from('receipts').remove([a.storage_path]); await sb.from('attachments').delete().eq('id', a.id); setExisting((x) => x.filter((y) => y.id !== a.id)); }

  return (
    <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="pt-1 text-center">
        <label className="block"><span className="text-xs font-medium text-muted-foreground">{money.cur}</span>
          <input inputMode="decimal" autoFocus placeholder="0" aria-label="Amount" aria-invalid={!!errors.amount} {...f.register('amount')} className="num block w-full bg-transparent text-center text-5xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40" /></label>
        {errors.amount?.message && <p role="alert" className="mt-1 text-xs text-destructive">{errors.amount.message}</p>}
      </div>
      {isTxn && !split && cats.length > 0 && (
        <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
          {chips.map((c) => <button key={c.id} type="button" aria-pressed={catVal === c.id} onClick={() => f.setValue('category_id', catVal === c.id ? '' : c.id, { shouldDirty: true })}
            className={cn('min-h-[40px] rounded-full border px-3.5 text-sm font-medium transition active:scale-95', catVal === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted')}>{c.name}</button>)}
          {cats.length > 8 && <button type="button" onClick={() => setShowAll((v) => !v)} className="min-h-[40px] rounded-full px-3 text-sm text-muted-foreground underline">{showAll ? 'Fewer' : `+${cats.length - 8} more`}</button>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Select aria-label={kind === 'income' || kind === 'deposit' ? 'Receiving account' : 'Account'} {...f.register('account_id')}><option value="">Account…</option>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        <Input type="datetime-local" aria-label="Date and time" {...f.register('occurred_at')} />
      </div>
      {(errors.account_id?.message || errors.occurred_at?.message) && <p role="alert" className="text-xs text-destructive">{errors.account_id?.message || errors.occurred_at?.message}</p>}
      <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="flex min-h-[40px] w-full items-center justify-between text-sm font-medium text-muted-foreground"><span>More details</span><ChevronDown className={cn('h-4 w-4 transition-transform', more && 'rotate-180')} /></button>
      {more && <div className="space-y-4">
      {isTxn && split && <p className="text-xs text-muted-foreground">Categories are set in the split rows below.</p>}
      {isTxn && <div className="grid gap-4 sm:grid-cols-2">
        <Field label={kind === 'income' ? 'Source' : 'Merchant'}><Input {...f.register('counterparty')} placeholder="Optional" /></Field>
        <Field label="Payment method"><Select {...f.register('payment_method')}><option value="">—</option>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
      </div>}
      <Field label="Description"><Input {...f.register('description')} placeholder="Optional" /></Field>
      {kind === 'expense' && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Toggle label="Essential expense" checked={f.watch('is_essential')} onChange={(v) => f.setValue('is_essential', v)} />
          <Toggle label="Recurring expense" checked={f.watch('is_recurring')} onChange={(v) => f.setValue('is_recurring', v)} />
          <Toggle label="Split across categories" checked={split} onChange={(v) => f.setValue('split', v)} />
          {split && (
            <div className="space-y-2 pt-2">
              {arr.fields.map((fl, i) => (
                <div key={fl.id} className="flex items-start gap-2">
                  <Select aria-label="Split category" {...f.register(`splits.${i}.category_id`)} className="flex-1"><option value="">Category…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                  <Input aria-label="Split amount" inputMode="decimal" placeholder="0.00" {...f.register(`splits.${i}.amount`)} className="w-28" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => arr.fields.length > 2 && arr.remove(i)} aria-label="Remove split"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => arr.append({ category_id: '', amount: '' })}>Add split</Button>
              {(errors.splits as { message?: string; root?: { message?: string } } | undefined)?.message && <p role="alert" className="text-xs text-destructive">{(errors.splits as { message?: string }).message}</p>}
              {errors.splits?.root?.message && <p role="alert" className="text-xs text-destructive">{errors.splits.root.message}</p>}
            </div>
          )}
        </div>
      )}
      {isTxn && <Field label="Notes"><Textarea {...f.register('notes')} placeholder="Optional" /></Field>}
      {isTxn && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Receipt / document</span>
          {existing.map((a) => <div key={a.id} className="flex items-center justify-between text-sm"><button type="button" className="flex items-center gap-1 underline" onClick={() => viewAtt(a.storage_path)}><Paperclip className="h-3 w-3" />{a.file_name}</button><Button type="button" variant="ghost" size="sm" onClick={() => delAtt(a)}>Remove</Button></div>)}
          <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-auto py-2" />
          <p className="text-xs text-muted-foreground">JPG, PNG, WebP or PDF, max 5 MB.</p>
        </div>
      )}
      </div>}
      <Actions busy={isSubmitting} label={initial ? 'Save changes' : 'Save'} onCancel={onDone} />
    </form>
  );
}

function TransferForm({ preset, onDone }: { preset?: Record<string, string>; onDone: () => void }) {
  const { sb, accounts, balances, money, tz, refresh } = useApp();
  const idem = useRef(uuid());
  const accs = accounts.filter((a) => !a.archived_at);
  const schema = useMemo(() => z.object({
    from: z.string().min(1, 'Choose a source'), to: z.string().min(1, 'Choose a destination'),
    amount: z.string().refine((v) => { const m = money.parse(v); return m !== null && m > 0; }, 'Enter a valid amount greater than 0'),
    date: z.string().refine(dateOk, 'Enter a valid date'), description: z.string().max(300).optional(),
  }).refine((v) => v.from !== v.to, { path: ['to'], message: 'Choose a different account' })
    .superRefine((v, ctx) => { const a = accs.find((x) => x.id === v.from), m = money.parse(v.amount); if (a && m && !a.allow_overdraft && m > (balances[a.id] ?? 0)) ctx.addIssue({ code: 'custom', path: ['amount'], message: `Exceeds available balance (${money.fmt(balances[a.id] ?? 0)})` }); }),
  [money, accs, balances]);
  type V = z.infer<typeof schema>;
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { from: preset?.from ?? accs[0]?.id ?? '', to: preset?.to ?? '', amount: '', date: nowLocalInput(tz), description: '' } });
  const { errors, isSubmitting } = f.formState;
  async function submit(v: V) {
    const { error } = await sb.rpc('create_transfer', { p_from: v.from, p_to: v.to, p_amount: money.parse(v.amount), p_occurred: fromLocalInput(v.date, tz), p_description: v.description || null, p_idem: idem.current });
    if (error) return void toast.error(errMsg(error));
    toast.success('Transfer recorded'); refresh(); onDone();
  }
  return (
    <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label={`Amount (${money.cur})`} error={errors.amount?.message}><Input inputMode="decimal" autoFocus placeholder="0.00" className="h-12 text-lg" {...f.register('amount')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" error={errors.from?.message}><Select {...f.register('from')}>{accs.map((a) => <option key={a.id} value={a.id}>{a.name} ({money.fmt(balances[a.id] ?? 0)})</option>)}</Select></Field>
        <Field label="To" error={errors.to?.message}><Select {...f.register('to')}><option value="">Select…</option>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
      </div>
      <Field label="Date & time" error={errors.date?.message}><Input type="datetime-local" {...f.register('date')} /></Field>
      <Field label="Description"><Input {...f.register('description')} placeholder="Optional" /></Field>
      <p className="text-xs text-muted-foreground">Transfers between your own accounts are not income or expenses.</p>
      <Actions busy={isSubmitting} label="Transfer" onCancel={onDone} />
    </form>
  );
}

function SavingsForm({ preset, onDone }: { preset?: Record<string, string>; onDone: () => void }) {
  const { sb, accounts, balances, money, tz, refresh } = useApp();
  const idem = useRef(uuid());
  const [goals, setGoals] = useState<Goal[]>([]);
  useMemo(() => { sb.from('savings_goals').select('*').eq('status', 'active').order('name').then(({ data }) => setGoals((data ?? []) as Goal[])); }, [sb]);
  const schema = useMemo(() => z.object({
    goal: z.string().min(1, 'Choose a goal'), type: z.enum(['contribution', 'withdrawal']),
    amount: z.string().refine((v) => { const m = money.parse(v); return m !== null && m > 0; }, 'Enter a valid amount greater than 0'),
    date: z.string().refine(dateOk, 'Enter a valid date'), account: z.string().optional(), note: z.string().max(300).optional(),
  }), [money]);
  type V = z.infer<typeof schema>;
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { goal: preset?.goal ?? '', type: (preset?.type as 'contribution') ?? 'contribution', amount: '', date: nowLocalInput(tz), account: '', note: '' } });
  const { errors, isSubmitting } = f.formState;
  const g = goals.find((x) => x.id === f.watch('goal'));
  async function submit(v: V) {
    const { error } = await sb.rpc('record_savings_entry', { p_goal: v.goal, p_type: v.type, p_amount: money.parse(v.amount), p_occurred: fromLocalInput(v.date, tz), p_note: v.note || null, p_account: g?.linked_account_id ? v.account || null : null, p_idem: idem.current });
    if (error) return void toast.error(errMsg(error));
    toast.success(v.type === 'contribution' ? 'Contribution added' : 'Withdrawal recorded'); refresh(); onDone();
  }
  return (
    <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label="Goal" error={errors.goal?.message}><Select {...f.register('goal')}><option value="">Select…</option>{goals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type"><Select {...f.register('type')}><option value="contribution">Contribution</option><option value="withdrawal">Withdrawal</option></Select></Field>
        <Field label={`Amount (${money.cur})`} error={errors.amount?.message}><Input inputMode="decimal" placeholder="0.00" {...f.register('amount')} /></Field>
      </div>
      {g?.linked_account_id && <Field label={f.watch('type') === 'contribution' ? 'Move money from' : 'Move money to'} hint="Creates a transfer to/from the goal's linked account. Leave empty to only update the goal."><Select {...f.register('account')}><option value="">Don't move money</option>{accounts.filter((a) => !a.archived_at && a.id !== g.linked_account_id).map((a) => <option key={a.id} value={a.id}>{a.name} ({money.fmt(balances[a.id] ?? 0)})</option>)}</Select></Field>}
      <Field label="Date & time" error={errors.date?.message}><Input type="datetime-local" {...f.register('date')} /></Field>
      <Field label="Note"><Input {...f.register('note')} placeholder="Optional" /></Field>
      <p className="text-xs text-muted-foreground">Savings entries are never counted as income.</p>
      <Actions busy={isSubmitting} label="Save" onCancel={onDone} />
    </form>
  );
}

function DebtForm({ preset, onDone }: { preset?: Record<string, string>; onDone: () => void }) {
  const { sb, accounts, money, profile, tz, refresh } = useApp();
  const idem = useRef(uuid());
  const [debts, setDebts] = useState<Debt[]>([]);
  useMemo(() => { sb.from('debts').select('*').eq('status', 'active').order('counterparty').then(({ data }) => setDebts((data ?? []) as Debt[])); }, [sb]);
  const accs = accounts.filter((a) => !a.archived_at);
  const schema = useMemo(() => {
    const amt = (label: string, req: boolean) => z.string().refine((v) => (!req && !v) || (money.parse(v) !== null && (money.parse(v) ?? 0) >= 0), `Invalid ${label}`);
    return z.object({ debt: z.string().min(1, 'Choose a debt'), account: z.string().min(1, 'Choose an account'), principal: amt('principal', true), interest: amt('interest', false), fees: amt('fees', false),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date'), note: z.string().max(300).optional() });
  }, [money]);
  type V = z.infer<typeof schema>;
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { debt: preset?.debt ?? '', account: profile.default_account_id ?? accs[0]?.id ?? '', principal: '', interest: '', fees: '', date: todayStr(tz), note: '' } });
  const { errors, isSubmitting } = f.formState;
  const d = debts.find((x) => x.id === f.watch('debt'));
  async function submit(v: V) {
    const p = money.parse(v.principal) ?? 0, i = money.parse(v.interest || '0') ?? 0, fe = money.parse(v.fees || '0') ?? 0;
    if (p + i + fe <= 0) return void f.setError('principal', { message: 'Enter an amount greater than 0' });
    if (d && p > d.outstanding_minor) return void f.setError('principal', { message: `Exceeds outstanding balance (${money.fmt(d.outstanding_minor)})` });
    const { error } = await sb.rpc('record_debt_payment', { p_debt: v.debt, p_account: v.account, p_principal: p, p_interest: i, p_fees: fe, p_paid_on: v.date, p_note: v.note || null, p_idem: idem.current });
    if (error) return void toast.error(errMsg(error));
    toast.success('Payment recorded'); refresh(); onDone();
  }
  return (
    <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label="Debt" error={errors.debt?.message}><Select {...f.register('debt')}><option value="">Select…</option>{debts.map((x) => <option key={x.id} value={x.id}>{x.direction === 'payable' ? 'I owe' : 'Owes me'}: {x.counterparty} ({money.fmt(x.outstanding_minor)})</option>)}</Select></Field>
      <Field label={d?.direction === 'receivable' ? 'Receiving account' : 'Paying account'} error={errors.account?.message}><Select {...f.register('account')}>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Principal" error={errors.principal?.message}><Input inputMode="decimal" placeholder="0.00" {...f.register('principal')} /></Field>
        <Field label="Interest" error={errors.interest?.message}><Input inputMode="decimal" placeholder="0.00" {...f.register('interest')} /></Field>
        <Field label="Fees" error={errors.fees?.message}><Input inputMode="decimal" placeholder="0.00" {...f.register('fees')} /></Field>
      </div>
      <Field label="Date" error={errors.date?.message}><Input type="date" {...f.register('date')} /></Field>
      <Field label="Note"><Input {...f.register('note')} placeholder="Optional" /></Field>
      <p className="text-xs text-muted-foreground">Only the principal reduces the debt balance. The total moves money in your account once.</p>
      <Actions busy={isSubmitting} label="Record payment" onCancel={onDone} />
    </form>
  );
}
