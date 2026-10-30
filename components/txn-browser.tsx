'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Pencil, Trash2, Repeat, Search } from 'lucide-react';
import { useApp, useLoad } from './app-provider';
import { useQuickAdd, METHODS } from './quick-add';
import { DateFilter, initFilter, type FilterState } from './date-filter';
import { Badge, Button, Card, Confirm, Empty, Input, Loading, Select } from './ui';
import { instants, fmtDate } from '@/lib/dates';
import { TXN_SELECT } from '@/lib/queries';
import { errMsg, cn } from '@/lib/utils';
import type { Txn } from '@/lib/types';

const PAGE = 20;
const INFLOW = ['income', 'deposit', 'transfer_in', 'debt_collection'];
const LABEL: Record<string, string> = { income: 'Income', expense: 'Expense', deposit: 'Deposit', withdrawal: 'Withdrawal', transfer_in: 'Transfer in', transfer_out: 'Transfer out', debt_payment: 'Debt payment', debt_collection: 'Debt collected' };
const TYPES: Record<string, string[] | undefined> = { all: undefined, income: ['income'], expense: ['expense'], transfer: ['transfer_in', 'transfer_out'], debt: ['debt_payment', 'debt_collection'], adjust: ['deposit', 'withdrawal'] };

export function TxnBrowser({ kinds, fixedType }: { kinds?: string[]; fixedType?: 'income' | 'expense' }) {
  const { sb, tz, money, accounts, categories, refresh, hide } = useApp();
  const qa = useQuickAdd();
  const [filter, setFilter] = useState<FilterState & { all: boolean }>({ ...initFilter(tz, 'month'), all: true });
  const [type, setType] = useState('all'); const [cat, setCat] = useState(''); const [acc, setAcc] = useState(''); const [method, setMethod] = useState('');
  const [min, setMin] = useState(''); const [max, setMax] = useState(''); const [q, setQ] = useState(''); const [dq, setDq] = useState('');
  const [sort, setSort] = useState('newest'); const [page, setPage] = useState(0);
  const [del, setDel] = useState<Txn | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setDq(q.replace(/[,()%*\\]/g, ' ').trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(0), [filter, type, cat, acc, method, min, max, sort]);

  const { data, loading, error } = useLoad(async () => {
    let r = sb.from('transactions').select(TXN_SELECT, { count: 'exact' }).is('voided_at', null);
    const k = kinds ?? TYPES[type]; if (k) r = r.in('kind', k);
    if (!filter.all) { const { start, end } = instants(filter.from, filter.to, tz); r = r.gte('occurred_at', start).lt('occurred_at', end!); }
    if (cat) r = r.eq('category_id', cat); if (acc) r = r.eq('account_id', acc); if (method) r = r.eq('payment_method', method);
    const lo = money.parse(min), hi = money.parse(max); if (lo !== null) r = r.gte('amount_minor', lo); if (hi !== null) r = r.lte('amount_minor', hi);
    if (dq) r = r.or(`description.ilike.%${dq}%,counterparty.ilike.%${dq}%,notes.ilike.%${dq}%`);
    r = sort === 'oldest' ? r.order('occurred_at', { ascending: true }) : sort === 'highest' ? r.order('amount_minor', { ascending: false }) : sort === 'lowest' ? r.order('amount_minor', { ascending: true }) : r.order('occurred_at', { ascending: false });
    const { data, count, error } = await r.order('id').range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error; return { rows: (data ?? []) as Txn[], count: count ?? 0 };
  }, [filter, type, cat, acc, method, min, max, dq, sort, page]);

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;
  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const shown = fixedType ? categories.filter((c) => c.kind === fixedType) : categories;
  async function remove() {
    if (!del) return; setBusy(true);
    const { error } = await sb.rpc('void_transaction', { p_id: del.id, p_reason: 'Deleted by user' });
    setBusy(false); if (error) return void toast.error(errMsg(error));
    toast.success(del.transfer_id ? 'Transfer reversed (both sides)' : 'Transaction deleted'); setDel(null); refresh();
  }
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE));
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search description, merchant, source or notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" /></label>
        <div className="flex items-center gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filter.all} onChange={(e) => setFilter({ ...filter, all: e.target.checked })} /> All time</label></div>
        {!filter.all && <DateFilter value={filter} onChange={(f) => setFilter({ ...f, all: false })} tz={tz} />}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {!kinds && <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option><option value="transfer">Transfers</option><option value="debt">Debt</option><option value="adjust">Deposits/withdrawals</option></Select>}
          <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{shown.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select aria-label="Account" value={acc} onChange={(e) => setAcc(e.target.value)}><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          <Select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)}><option value="">All methods</option>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select>
          <Input aria-label="Minimum amount" inputMode="decimal" placeholder="Min amount" value={min} onChange={(e) => setMin(e.target.value)} />
          <Input aria-label="Maximum amount" inputMode="decimal" placeholder="Max amount" value={max} onChange={(e) => setMax(e.target.value)} />
          <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></Select>
        </div>
      </Card>
      <Card>
        {loading && !data ? <div className="p-4"><Loading /></div> : error ? <Empty title="Could not load transactions" hint={error} /> : !data?.rows.length ? <Empty title="No transactions found" hint="Try adjusting your filters, or add a new transaction with the + button." /> : (
          <ul className="divide-y divide-border">
            {data.rows.map((t) => {
              const inflow = INFLOW.includes(t.kind); const editable = ['income', 'expense', 'deposit', 'withdrawal'].includes(t.kind) && !t.transfer_id;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-medium">{t.description || t.counterparty || catName(t.category_id) || LABEL[t.kind]}</span>
                      {t.transaction_splits?.length ? <Badge tone="info">Split</Badge> : catName(t.category_id) && <Badge>{catName(t.category_id)}</Badge>}
                      {t.kind === 'expense' && t.is_essential === false && <Badge tone="warning">Non-essential</Badge>}
                      {t.is_recurring && <Badge tone="info"><Repeat className="mr-1 h-3 w-3" />Recurring</Badge>}
                      {(t.kind.startsWith('transfer') || t.kind.startsWith('debt') || t.kind === 'deposit' || t.kind === 'withdrawal') && <Badge>{LABEL[t.kind]}</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{fmtDate(t.occurred_at, tz, 'd MMM yyyy, HH:mm')} · {accName(t.account_id)}{t.payment_method ? ` · ${t.payment_method}` : ''}</div>
                  </div>
                  <div className={cn('num shrink-0 text-right font-semibold', inflow ? 'text-success' : 'text-foreground', hide && 'blur-sm')}>{inflow ? '+' : '−'}{money.fmt(t.amount_minor)}</div>
                  <div className="flex shrink-0">
                    {editable && <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => qa.open(t.kind as 'income', t)}><Pencil className="h-4 w-4" /></Button>}
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDel(t)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {data && data.count > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">{data.count} result{data.count === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button><span>{page + 1} / {pages}</span><Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button></div>
          </div>
        )}
      </Card>
      <Confirm open={!!del} busy={busy} title="Delete transaction?" desc={del?.transfer_id ? 'This reverses both sides of the transfer. A reversal record is kept in your audit history.' : 'The transaction is removed from your balances and reports. A reversal record is kept in your audit history.'} onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}
