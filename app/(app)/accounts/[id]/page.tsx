'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApp, useLoad } from '@/components/app-provider';
import { Card, Empty, Loading, PageHeader, Stat } from '@/components/ui';
import { fmtDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { AccountStatement } from '@/components/account-statement';
import { MpesaImportButton } from '@/components/mpesa-import';
import type { Txn } from '@/lib/types';

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>(); const { sb, tz, money, accounts, balances } = useApp();
  const acc = accounts.find((a) => a.id === id);
  const { data, loading } = useLoad(async () => { const { data, error } = await sb.from('transactions').select('*').eq('account_id', id).is('voided_at', null).order('occurred_at', { ascending: false }).limit(500); if (error) throw error; return data as Txn[]; }, [id]);
  if (!acc) return <Empty title="Account not found" hint="It may have been removed." action={<Link className="underline" href="/accounts">Back to accounts</Link>} />;
  // running balance (newest first): balance after each row
  let run = balances[id] ?? 0; const rows = (data ?? []).map((t) => { const after = run; run -= t.signed_amount_minor; return { t, after }; });
  return (
    <>
      <PageHeader title={acc.name} desc="Daily opening and closing balances, plus every transaction." actions={<>{acc.type === 'mobile_money' && <MpesaImportButton acc={acc} variant="default" />}<Link href="/accounts" className="text-sm underline">All accounts</Link></>} />
      <div className="mb-4 grid grid-cols-2 gap-3"><Stat label="Balance" value={money.fmt(balances[id] ?? 0)} /><Stat label="Starting balance" value={money.fmt(acc.opening_balance_minor)} sub="When you added this account" /></div>
      <AccountStatement acc={acc} />
      <h2 className="mb-2 mt-6 text-sm font-semibold">All transactions</h2>
      <Card>{loading && !data ? <div className="p-4"><Loading /></div> : !rows.length ? <Empty title="No transactions yet" /> : <ul className="divide-y divide-border">{rows.map(({ t, after }) => (
        <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><div className="min-w-0"><div className="truncate font-medium">{t.description || t.counterparty || t.kind.replace('_', ' ')}</div><div className="text-xs text-muted-foreground">{fmtDate(t.occurred_at, tz, 'd MMM yyyy, HH:mm')} · {t.kind.replace('_', ' ')}</div></div>
          <div className="text-right"><div className={cn('num font-semibold', t.signed_amount_minor > 0 && 'text-success')}>{t.signed_amount_minor > 0 ? '+' : '−'}{money.fmt(t.amount_minor)}</div><div className="num text-xs text-muted-foreground">Bal {money.fmt(after)}</div></div></li>))}</ul>}</Card>
    </>
  );
}
