import type { Txn } from './types';
import { dayOf, eachDay } from './dates';

export type StatementDay = { date: string; opening: number; moneyIn: number; moneyOut: number; closing: number; count: number };
export type Statement = { opening: number; closing: number; moneyIn: number; moneyOut: number; count: number; days: StatementDay[]; asOf: string | null };

/**
 * Opening/closing balance statement for ONE account.
 * `txns` must be every non-voided transaction of the account from the start of `from` up to now
 * (no upper bound) so the opening balance can be derived from the live balance:
 *   opening(from) = currentBalance - sum(all txns since `from`)
 * `asOf` caps the statement at today so future days of the period are not listed.
 */
export function buildStatement(txns: Pick<Txn, 'occurred_at' | 'signed_amount_minor'>[], currentBalance: number,
  from: string, to: string, today: string, tz: string): Statement {
  const since = txns.reduce((s, t) => s + t.signed_amount_minor, 0);
  const openingAtFrom = currentBalance - since;
  if (from > today) return { opening: currentBalance, closing: currentBalance, moneyIn: 0, moneyOut: 0, count: 0, days: [], asOf: null };
  const last = to < today ? to : today;
  const byDay = new Map<string, { in: number; out: number; n: number }>();
  for (const t of txns) {
    const d = dayOf(t.occurred_at, tz);
    if (d < from || d > last) continue;
    const e = byDay.get(d) ?? { in: 0, out: 0, n: 0 };
    if (t.signed_amount_minor >= 0) e.in += t.signed_amount_minor; else e.out += -t.signed_amount_minor;
    e.n += 1; byDay.set(d, e);
  }
  let run = openingAtFrom; const days: StatementDay[] = [];
  for (const date of eachDay(from, last)) {
    const e = byDay.get(date) ?? { in: 0, out: 0, n: 0 };
    const opening = run; run = opening + e.in - e.out;
    days.push({ date, opening, moneyIn: e.in, moneyOut: e.out, closing: run, count: e.n });
  }
  return {
    opening: openingAtFrom, closing: run, asOf: last,
    moneyIn: days.reduce((s, d) => s + d.moneyIn, 0), moneyOut: days.reduce((s, d) => s + d.moneyOut, 0),
    count: days.reduce((s, d) => s + d.count, 0), days,
  };
}
