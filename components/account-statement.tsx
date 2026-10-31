'use client';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Scale } from 'lucide-react';
import { useApp, useLoad } from './app-provider';
import { DateFilter, initFilter, type FilterState } from './date-filter';
import { Badge, Button, Card, CardBody, CardHeader, Confirm, Empty, Field, Input, Loading, Stat, Toggle } from './ui';
import { fetchTxns } from '@/lib/queries';
import { buildStatement } from '@/lib/statement';
import { fmtDay, todayStr } from '@/lib/dates';
import { cn, errMsg } from '@/lib/utils';
import { postAdjustment } from '@/lib/adjust';
import type { Account } from '@/lib/types';

export function AccountStatement({ acc }: { acc: Account }) {
  const { sb, tz, money, balances, hide, refresh } = useApp();
  const [f, setF] = useState<FilterState>(() => initFilter(tz, 'week'));
  const [onlyActive, setOnlyActive] = useState(false);
  const bal = balances[acc.id] ?? 0; const today = todayStr(tz);
  const { data, loading, error } = useLoad(() => fetchTxns(sb, tz, f.from, undefined, { accountId: acc.id }), [acc.id, f.from]);
  const st = useMemo(() => (data ? buildStatement(data, bal, f.from, f.to, today, tz) : null), [data, bal, f.from, f.to, today, tz]);
  const blur = hide ? 'blur-sm' : '';
  const isMobile = acc.type === 'mobile_money';
  const days = st ? [...st.days].reverse().filter((d) => !onlyActive || d.count > 0) : [];

  return (
    <div className="space-y-4">
      <Reconcile acc={acc} bal={bal} onDone={refresh} mobile={isMobile} />
      <Card>
        <CardHeader title={isMobile ? 'M-Pesa statement' : 'Statement'} action={st?.asOf ? <Badge>up to {fmtDay(st.asOf, 'd MMM')}</Badge> : undefined} />
        <CardBody className="space-y-4">
          <DateFilter value={f} onChange={setF} tz={tz} />
          {error ? <p className="text-sm text-destructive">{error}</p> : loading && !st ? <Loading rows={2} /> : st && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Opening balance" value={<span className={blur}>{money.fmt(st.opening)}</span>} sub={`Start of ${fmtDay(f.from, 'd MMM')}`} />
                <Stat label="Money in" value={<span className={blur}>{money.fmt(st.moneyIn)}</span>} tone="success" />
                <Stat label="Money out" value={<span className={blur}>{money.fmt(st.moneyOut)}</span>} tone="danger" />
                <Stat label="Closing balance" value={<span className={blur}>{money.fmt(st.closing)}</span>} sub={st.asOf ? `End of ${fmtDay(st.asOf, 'd MMM')}` : undefined} />
              </div>
              {st.days.length > 31 && <Toggle label="Hide days with no activity" checked={onlyActive} onChange={setOnlyActive} />}
              {!days.length ? <Empty title="No days to show" hint="This period hasn't started yet." /> : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Day</th><th className="px-3 text-right font-medium">Opening</th><th className="px-3 text-right font-medium">In</th><th className="px-3 text-right font-medium">Out</th><th className="pl-3 text-right font-medium">Closing</th></tr></thead>
                  <tbody>{days.map((d) => (
                    <tr key={d.date} className={cn('border-b border-border/60 last:border-0', d.count === 0 && 'text-muted-foreground')}>
                      <td className="whitespace-nowrap py-2 pr-3">{fmtDay(d.date)}{d.count > 0 && <span className="ml-1.5 text-xs text-muted-foreground">· {d.count}</span>}</td>
                      <td className={cn('num px-3 text-right', blur)}>{money.fmt(d.opening)}</td>
                      <td className={cn('num px-3 text-right', d.moneyIn > 0 && 'text-success', blur)}>{d.moneyIn > 0 ? '+' + money.fmt(d.moneyIn) : '–'}</td>
                      <td className={cn('num px-3 text-right', d.moneyOut > 0 && 'text-destructive', blur)}>{d.moneyOut > 0 ? '−' + money.fmt(d.moneyOut) : '–'}</td>
                      <td className={cn('num pl-3 text-right font-semibold', blur)}>{money.fmt(d.closing)}</td></tr>))}</tbody>
                </table></div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** Compare the real balance on the phone/bank app with what this app calculates, and optionally post the difference. */
function Reconcile({ acc, bal, onDone, mobile }: { acc: Account; bal: number; onDone: () => void; mobile: boolean }) {
  const { sb, tz, money, hide } = useApp();
  const [v, setV] = useState(''); const [ask, setAsk] = useState(false); const [busy, setBusy] = useState(false);
  const actual = v.trim() ? money.parse(v) : null; const invalid = v.trim() !== '' && actual === null;
  const diff = actual === null ? null : actual - bal; const blur = hide ? 'blur-sm' : '';
  async function post() {
    if (diff === null || diff === 0) return; setBusy(true);
    try {
      await postAdjustment(sb, acc, diff, mobile);
      toast.success('Balance adjusted — it now matches your actual balance'); setV(''); setAsk(false); onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Scale className="h-4 w-4" />Check against your {mobile ? 'M-Pesa' : 'real'} balance</span>} />
      <CardBody className="space-y-3">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Field label={`Balance shown in your ${mobile ? 'M-Pesa app or SMS' : 'bank/wallet app'} right now (${money.cur})`} error={invalid ? 'Enter a valid amount' : undefined} hint={`This app calculates: ${hide ? '••••' : money.fmt(bal)}`}>
            <Input inputMode="decimal" placeholder="e.g. 5,230.50" value={v} onChange={(e) => setV(e.target.value)} />
          </Field>
        </div>
        {diff !== null && (diff === 0
          ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Matches — your records are accurate.</p>
          : <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p>Difference: <b className={cn('num', diff > 0 ? 'text-success' : 'text-destructive', blur)}>{diff > 0 ? '+' : '−'}{money.fmt(Math.abs(diff))}</b> — {diff > 0 ? 'you have more than recorded (missing income or deposit?)' : 'you have less than recorded (missing expense, fee or withdrawal?)'}.</p>
              <p className="text-xs text-muted-foreground">Check recent transactions first. If you can't find the cause, post an adjustment so your balance matches.</p>
              <Button size="sm" onClick={() => setAsk(true)}>Post adjustment</Button>
            </div>)}
      </CardBody>
      <Confirm open={ask} title="Post balance adjustment?" confirmLabel="Post adjustment" busy={busy}
        desc={diff === null ? '' : `This records a ${diff > 0 ? 'deposit' : 'withdrawal'} of ${money.fmt(Math.abs(diff))} on "${acc.name}" so the balance becomes ${money.fmt(actual ?? 0)}. You can void it later from Transactions.`}
        onConfirm={post} onCancel={() => setAsk(false)} />
    </Card>
  );
}
