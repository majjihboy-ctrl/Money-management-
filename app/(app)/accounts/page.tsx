'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, ArrowLeftRight, Archive, Pencil, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { useQuickAdd } from '@/components/quick-add';
import { Badge, Button, Card, Confirm, Empty, Field, Input, Modal, PageHeader, Select, Stat, Toggle } from '@/components/ui';
import { inputValue } from '@/lib/money';
import { errMsg } from '@/lib/utils';
import type { Account } from '@/lib/types';

const TYPES = [['cash', 'Cash'], ['bank', 'Bank account'], ['mobile_money', 'Mobile money'], ['savings', 'Savings account'], ['other', 'Other']] as const;
export default function Accounts() {
  const { sb, accounts, balances, money, refresh, hide } = useApp(); const qa = useQuickAdd();
  const [edit, setEdit] = useState<Account | 'new' | null>(null); const [arch, setArch] = useState<Account | null>(null); const [showArch, setShowArch] = useState(false);
  const active = accounts.filter((a) => !a.archived_at); const archived = accounts.filter((a) => a.archived_at);
  const total = active.reduce((s, a) => s + (balances[a.id] ?? 0), 0);
  const spendable = active.filter((a) => a.type !== 'savings').reduce((s, a) => s + (balances[a.id] ?? 0), 0);
  async function archive(a: Account, on: boolean) { const { error } = await sb.from('accounts').update({ archived_at: on ? new Date().toISOString() : null }).eq('id', a.id); if (error) return void toast.error(errMsg(error)); toast.success(on ? 'Account archived' : 'Account restored'); setArch(null); refresh(); }
  return (
    <>
      <PageHeader title="Accounts" desc="Cash, bank, mobile money and savings accounts." actions={<><Button variant="outline" onClick={() => qa.open('transfer')}><ArrowLeftRight className="h-4 w-4" />Transfer</Button><Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />New account</Button></>} />
      <div className="mb-4 grid grid-cols-2 gap-3"><Stat label="Net worth (all accounts)" value={<span className={hide ? 'blur-sm' : ''}>{money.fmt(total)}</span>} sub="Sum of every active account balance" /><Stat label="Spendable" value={<span className={hide ? 'blur-sm' : ''}>{money.fmt(spendable)}</span>} sub="Excludes savings accounts" /></div>
      {!active.length ? <Card><Empty title="No accounts" hint="Create an account to start recording money." action={<Button onClick={() => setEdit('new')}>Create account</Button>} /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {active.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between"><div><Link href={`/accounts/${a.id}`} className="font-semibold hover:underline">{a.name}</Link><div className="mt-1"><Badge>{TYPES.find((t) => t[0] === a.type)?.[1]}</Badge></div></div>
                <div className="flex"><Button variant="ghost" size="icon" aria-label="Edit account" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Archive account" onClick={() => setArch(a)}><Archive className="h-4 w-4" /></Button></div></div>
              <div className={`num mt-3 text-2xl font-semibold ${(balances[a.id] ?? 0) < 0 ? 'text-destructive' : ''} ${hide ? 'blur-sm' : ''}`}>{money.fmt(balances[a.id] ?? 0)}</div>
              <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => qa.open('deposit', undefined, { account_id: a.id })}><ArrowDownToLine className="h-3.5 w-3.5" />Deposit</Button><Button size="sm" variant="outline" onClick={() => qa.open('withdrawal', undefined, { account_id: a.id })}><ArrowUpFromLine className="h-3.5 w-3.5" />Withdraw</Button></div>
            </Card>
          ))}
        </div>
      )}
      {archived.length > 0 && <div className="mt-6"><Button variant="ghost" size="sm" onClick={() => setShowArch(!showArch)}>{showArch ? 'Hide' : 'Show'} archived ({archived.length})</Button>{showArch && <div className="mt-2 space-y-2">{archived.map((a) => <Card key={a.id} className="flex items-center justify-between p-3 text-sm"><span>{a.name}</span><Button size="sm" variant="outline" onClick={() => archive(a, false)}>Restore</Button></Card>)}</div>}</div>}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New account' : 'Edit account'}>{edit && <AccountForm key={typeof edit === 'string' ? 'n' : edit.id} initial={edit === 'new' ? undefined : edit} onDone={() => { setEdit(null); refresh(); }} />}</Modal>
      <Confirm open={!!arch} title="Archive account?" confirmLabel="Archive" desc={`"${arch?.name}" will be hidden from pickers and totals. Its history is kept and you can restore it any time.`} onConfirm={() => arch && archive(arch, true)} onCancel={() => setArch(null)} />
    </>
  );
}

function AccountForm({ initial, onDone }: { initial?: Account; onDone: () => void }) {
  const { sb, money } = useApp();
  const schema = useMemo(() => z.object({ name: z.string().trim().min(1, 'Enter a name').max(80), type: z.string(), opening: z.string().refine((v) => /^-?\d+(\.\d+)?$/.test(v.replace(/,/g, '')) && money.parse(v.replace('-', '')) !== null, 'Enter a valid amount'), overdraft: z.boolean() }), []);
  type V = z.infer<typeof schema>;
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { name: initial?.name ?? '', type: initial?.type ?? 'cash', opening: initial ? inputValue(initial.opening_balance_minor, money.cur) : '0', overdraft: initial?.allow_overdraft ?? false } });
  const { errors, isSubmitting } = f.formState;
  async function submit(v: V) {
    const raw = v.opening.replace(/,/g, ''); const neg = raw.startsWith('-'); const m = money.parse(neg ? raw.slice(1) : raw)!;
    const row = { name: v.name, type: v.type, opening_balance_minor: neg ? -m : m, allow_overdraft: v.overdraft };
    const { error } = initial ? await sb.from('accounts').update(row).eq('id', initial.id) : await sb.from('accounts').insert(row);
    if (error) return void toast.error(error.code === '23505' ? 'You already have an account with that name' : errMsg(error));
    toast.success('Account saved'); onDone();
  }
  return (
    <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label="Name" error={errors.name?.message}><Input {...f.register('name')} placeholder="e.g. M-Pesa, Equity Bank" /></Field>
      <Field label="Type"><Select {...f.register('type')}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
      <Field label={`Opening balance (${money.cur})`} error={errors.opening?.message} hint="Balances are always opening balance + posted transactions."><Input inputMode="decimal" {...f.register('opening')} /></Field>
      <Toggle label="Allow overdraft (balance may go below zero)" checked={f.watch('overdraft')} onChange={(v) => f.setValue('overdraft', v)} />
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={isSubmitting}>Save</Button></div>
    </form>
  );
}
