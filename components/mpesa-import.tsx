'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, MessageSquareText } from 'lucide-react';
import { useApp } from './app-provider';
import { Badge, Button, Field, Modal, Select, Textarea, Toggle } from './ui';
import { parseAll, netEffect, type MpesaRow } from '@/lib/mpesa';
import { postAdjustment } from '@/lib/adjust';
import { fmtDate } from '@/lib/dates';
import { cn, errMsg, uuid } from '@/lib/utils';
import type { Account } from '@/lib/types';

type Result = { saved: number; failed: string[]; sms: number | null; app: number; fuliza: boolean };

export function MpesaImportButton({ acc, variant = 'outline' }: { acc: Account; variant?: 'outline' | 'default' }) {
  const [open, setOpen] = useState(false);
  return (<>
    <Button size="sm" variant={variant} onClick={() => setOpen(true)}><MessageSquareText className="h-3.5 w-3.5" />Import M-Pesa SMS</Button>
    <Modal open={open} onClose={() => setOpen(false)} title="Import M-Pesa messages" wide>{open && <Importer acc={acc} onClose={() => setOpen(false)} />}</Modal>
  </>);
}

function Importer({ acc, onClose }: { acc: Account; onClose: () => void }) {
  const { sb, tz, money, categories, refresh } = useApp();
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ReturnType<typeof parseAll> | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set()); const [cat, setCat] = useState<Record<string, string>>({});
  const [dupes, setDupes] = useState<Set<string>>(new Set()); const [fresh, setFresh] = useState(false);
  const [autoStart, setAutoStart] = useState(true); const [fuliza, setFuliza] = useState(true);
  const [res, setRes] = useState<Result | null>(null);
  const good = (rows ?? []).filter((r): r is MpesaRow => r.ok); const bad = (rows ?? []).filter((r) => !r.ok);
  const catId = (name: string | null, kind: 'income' | 'expense') => (name ? categories.find((c) => c.kind === kind && c.name === name && !c.archived_at)?.id ?? null : null);

  async function read() {
    const parsed = parseAll(text, tz).slice(0, 300);
    if (!parsed.length) return void toast.error('Paste at least one M-Pesa message');
    setBusy(true);
    try {
      const codes = parsed.filter((r): r is MpesaRow => r.ok && !r.fuliza?.dueDate && r.amountMinor > 0).map((r) => r.code); const found = new Set<string>();
      for (let i = 0; i < codes.length; i += 40) {
        const chunk = codes.slice(i, i + 40);
        const { data, error } = await sb.from('transactions').select('notes').eq('account_id', acc.id).is('voided_at', null).or(chunk.map((c) => `notes.ilike.%${c}%`).join(','));
        if (error) throw error; (data ?? []).forEach((d) => chunk.forEach((c) => d.notes?.includes(c) && found.add(c)));
      }
      const { count } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('account_id', acc.id).is('voided_at', null);
      setFresh((count ?? 0) === 0); setDupes(found); setRows(parsed);
      setSel(new Set(parsed.filter((r): r is MpesaRow => r.ok && !found.has(r.code)).map((r) => r.code)));
      setCat(Object.fromEntries(parsed.filter((r): r is MpesaRow => r.ok && !!r.category).map((r) => [r.code, r.category!])));
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  async function run() {
    const picks = good.filter((r) => sel.has(r.code)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || (a.txKind === 'income' ? -1 : 1));
    if (!picks.length) return void toast.error('Nothing selected'); setBusy(true);
    const failed: string[] = []; let saved = 0;
    try {
      const withBal = picks.filter((r) => r.balanceMinor !== null && r.amountMinor > 0);
      if (fresh && autoStart && withBal.length) { // derive starting balance so the account lines up with M-Pesa from the first message
        const first = withBal[0]; const start = first.balanceMinor! - netEffect(first);
        const { error } = await sb.from('accounts').update({ opening_balance_minor: start }).eq('id', acc.id); if (error) throw error;
      }
      const feeCat = categories.find((c) => c.kind === 'expense' && c.name === 'Bank Charges' && !c.archived_at)?.id ?? null;
      for (const r of picks) {
        if (r.amountMinor <= 0) continue;
        try {
          const kind = r.txKind; const isTxn = kind === 'income' || kind === 'expense';
          const base = { account_id: acc.id, occurred_at: r.occurredAt, payment_method: 'M-Pesa', is_recurring: false };
          let { error } = await sb.rpc('save_transaction', { p: { ...base, id: uuid(), kind, amount_minor: r.amountMinor, category_id: isTxn ? catId(cat[r.code] ?? r.category, kind as 'income' | 'expense') : null,
            counterparty: r.counterparty, description: r.description, notes: `M-Pesa ref ${r.code}`, is_essential: kind === 'expense' ? true : undefined }, p_splits: [] });
          if (error) throw error; saved++;
          if (r.feeMinor > 0) {
            ({ error } = await sb.rpc('save_transaction', { p: { ...base, id: uuid(), kind: 'expense', amount_minor: r.feeMinor, category_id: feeCat, counterparty: 'Safaricom',
              description: `M-Pesa fee · ${r.label}`, notes: `M-Pesa ref ${r.code} (fee)`, is_essential: true }, p_splits: [] }));
            if (error) throw error;
          }
        } catch (e) { failed.push(`${r.code}: ${errMsg(e)}`); }
      }
      let fz = false; const last = [...picks].reverse().find((r) => r.fuliza);
      if (fuliza && last?.fuliza) {
        const out = last.fuliza.outstandingMinor; const d = last.fuliza.dueDate?.split('/'); const due = d ? `${d[2].length === 2 ? '20' + d[2] : d[2]}-${d[1].padStart(2, '0')}-${d[0].padStart(2, '0')}` : null;
        const { data: ex } = await sb.from('debts').select('id, original_minor').eq('counterparty', 'Fuliza M-PESA').eq('direction', 'payable').neq('status', 'archived').limit(1);
        if (ex?.[0]) { const { error } = await sb.from('debts').update({ outstanding_minor: out, original_minor: Math.max(Number(ex[0].original_minor), out), status: out === 0 ? 'paid' : 'active', ...(due ? { due_date: due } : {}) }).eq('id', ex[0].id); if (!error) fz = true; }
        else if (out > 0) { const { error } = await sb.from('debts').insert({ direction: 'payable', counterparty: 'Fuliza M-PESA', original_minor: out, outstanding_minor: out, due_date: due, notes: 'Tracked from M-Pesa messages' }); if (!error) fz = true; }
      }
      const { data: b } = await sb.from('account_balances').select('balance_minor').eq('account_id', acc.id).maybeSingle();
      const latest = [...withBal].sort((x, y) => x.occurredAt.localeCompare(y.occurredAt)).pop();
      setRes({ saved, failed, sms: latest?.balanceMinor ?? null, app: Number(b?.balance_minor ?? 0), fuliza: fz }); refresh();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  async function adjust(diff: number) { setBusy(true); try { await postAdjustment(sb, acc, diff, true); toast.success('Balance adjusted'); setRes((r) => (r ? { ...r, app: r.app + diff } : r)); refresh(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } }

  if (res) {
    const diff = res.sms === null ? null : res.sms - res.app;
    return (<div className="space-y-4">
      <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-success" />Imported {res.saved} transaction{res.saved === 1 ? '' : 's'} into {acc.name}.{res.fuliza && ' Fuliza balance updated in Debts.'}</p>
      {res.failed.length > 0 && <div className="rounded-lg border border-destructive/40 p-3 text-sm"><b className="text-destructive">{res.failed.length} could not be saved</b><ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">{res.failed.slice(0, 6).map((f) => <li key={f}>{f}</li>)}</ul>
        {res.failed.some((f) => /insufficient/i.test(f)) && <p className="mt-2 text-xs">Tip: the account balance ran out of money. Check its starting balance, or turn on “Allow overdraft” for it.</p>}</div>}
      {diff === null ? null : diff === 0
        ? <p className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Your balance matches the latest M-Pesa balance ({money.fmt(res.app)}).</p>
        : <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"><p>Latest M-Pesa message says <b className="num">{money.fmt(res.sms!)}</b>, this app shows <b className="num">{money.fmt(res.app)}</b> — difference <b className={cn('num', diff > 0 ? 'text-success' : 'text-destructive')}>{diff > 0 ? '+' : '−'}{money.fmt(Math.abs(diff))}</b>.</p>
          <p className="text-xs text-muted-foreground">Usually caused by messages you haven&apos;t pasted yet, or Fuliza. Paste the missing ones, or post an adjustment.</p>
          <Button size="sm" loading={busy} onClick={() => adjust(diff)}>Post adjustment</Button></div>}
      <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div></div>);
  }
  if (!rows) return (<div className="space-y-3">
    <Field label="Paste your M-Pesa SMS messages (one or many)" hint="Open Messages → M-Pesa → copy. Messages you've already imported are skipped automatically."><Textarea className="min-h-[200px] font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="QJA1B2C3D4 Confirmed. Ksh500.00 sent to JANE WANJIKU 0722… on 5/10/26 at 12:40 PM. New M-PESA balance is Ksh5,493.00. Transaction cost, Ksh7.00." /></Field>
    <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={read} disabled={!text.trim()}>Read messages</Button></div></div>);

  const income = categories.filter((c) => c.kind === 'income' && !c.archived_at); const expense = categories.filter((c) => c.kind === 'expense' && !c.archived_at);
  return (<div className="space-y-3">
    <p className="text-sm text-muted-foreground">Found <b>{good.length}</b> message{good.length === 1 ? '' : 's'}{dupes.size > 0 && <>, <b>{dupes.size}</b> already recorded</>}{bad.length > 0 && <>, <b>{bad.length}</b> not recognised</>}. Review, change categories, then import.</p>
    <ul className="max-h-[46vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
      {good.map((r) => { const dupe = dupes.has(r.code); const info = r.amountMinor === 0; return (
        <li key={r.code} className={cn('flex items-start gap-3 p-3 text-sm', dupe && 'opacity-60')}>
          <input type="checkbox" className="mt-1 h-4 w-4" checked={sel.has(r.code)} disabled={dupe} aria-label={`Import ${r.code}`} onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(r.code) : n.delete(r.code); return n; })} />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{r.counterparty ?? r.label}</span><Badge tone={r.txKind === 'income' || r.txKind === 'deposit' ? 'success' : 'muted'}>{r.label}</Badge>{dupe && <Badge tone="warning">Already recorded</Badge>}</div>
            <div className="text-xs text-muted-foreground">{info ? `Outstanding ${money.fmt(r.fuliza!.outstandingMinor)}` : `${fmtDate(r.occurredAt, tz, 'd MMM, HH:mm')} · ${r.code}${r.feeMinor ? ` · fee ${money.fmt(r.feeMinor)}` : ''}`}</div>
            {!info && !dupe && (r.txKind === 'income' || r.txKind === 'expense') && <Select className="mt-2 h-8 text-xs" aria-label="Category" value={cat[r.code] ?? ''} onChange={(e) => setCat((c) => ({ ...c, [r.code]: e.target.value }))}><option value="">No category</option>{(r.txKind === 'income' ? income : expense).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</Select>}</div>
          {!info && <div className={cn('num shrink-0 text-right font-semibold', (r.txKind === 'income' || r.txKind === 'deposit') && 'text-success')}>{r.txKind === 'income' || r.txKind === 'deposit' ? '+' : '−'}{money.fmt(r.amountMinor)}</div>}
        </li>); })}
      {bad.map((r, i) => <li key={i} className="p-3 text-xs text-muted-foreground"><b className="text-foreground">Skipped:</b> {r.ok ? '' : r.reason}<div className="mt-1 truncate">{r.raw}</div></li>)}
    </ul>
    {fresh && <Toggle label="This account is new — set its starting balance from these messages so it matches M-Pesa" checked={autoStart} onChange={setAutoStart} />}
    {good.some((r) => r.fuliza) && <Toggle label="Track my Fuliza balance in Debts" checked={fuliza} onChange={setFuliza} />}
    <div className="flex justify-between gap-2"><Button variant="outline" onClick={() => setRows(null)}>Back</Button><Button loading={busy} onClick={run} disabled={!sel.size}>Import {sel.size} message{sel.size === 1 ? '' : 's'}</Button></div></div>);
}
