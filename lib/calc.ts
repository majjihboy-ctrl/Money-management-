import type { Txn, Budget, BudgetView, BudgetStatus } from './types';
import { dayOf } from './dates';

export const isExpense = (k: string) => k === 'expense' || k === 'debt_payment';
export const catAmounts = (t: Txn) =>
  t.transaction_splits?.length ? t.transaction_splits.map((s) => ({ category_id: s.category_id as string | null, amount: s.amount_minor }))
                               : [{ category_id: t.category_id, amount: t.amount_minor }];

export function statusOf(pct: number, thresholds: number[]): BudgetStatus {
  const [a, b, c] = [...thresholds].sort((x, y) => x - y).concat([75, 90, 100].slice(thresholds.length));
  if (pct >= c) return 'Exceeded';
  if (pct >= b) return 'Near Limit';
  if (pct >= a) return 'Warning';
  return 'On Track';
}
export function budgetView(b: Budget, txns: Txn[], tz: string): BudgetView {
  let spent = 0;
  for (const t of txns) {
    if (!isExpense(t.kind)) continue;
    const d = dayOf(t.occurred_at, tz);
    if (d < b.start_date || d > b.end_date) continue;
    for (const a of catAmounts(t)) if (!b.category_id || a.category_id === b.category_id) spent += a.amount;
  }
  const pct = b.amount_minor > 0 ? (spent / b.amount_minor) * 100 : 0;
  return { ...b, spent, pct, status: statusOf(pct, b.thresholds) };
}

export type Summary = ReturnType<typeof summarize>;
/** Income = kind income. Expenses = kind expense + debt_payment. Transfers, deposits, withdrawals, debt collections are balance movements only. */
export function summarize(txns: Txn[], catName: (id: string | null, t?: Txn) => string, tz: string) {
  let income = 0, expense = 0, essential = 0, nonEssential = 0, debtPaid = 0;
  const byCat = new Map<string, number>(), incCat = new Map<string, number>(), incSrc = new Map<string, number>(), byMethod = new Map<string, number>();
  const byDay = new Map<string, { income: number; expense: number }>();
  const day = (d: string) => { let v = byDay.get(d); if (!v) { v = { income: 0, expense: 0 }; byDay.set(d, v); } return v; };
  for (const t of txns) {
    const d = dayOf(t.occurred_at, tz);
    if (t.kind === 'income') {
      income += t.amount_minor; day(d).income += t.amount_minor;
      const n = catName(t.category_id, t); incCat.set(n, (incCat.get(n) ?? 0) + t.amount_minor);
      const s = t.counterparty?.trim() || 'Unspecified'; incSrc.set(s, (incSrc.get(s) ?? 0) + t.amount_minor);
    } else if (isExpense(t.kind)) {
      expense += t.amount_minor; day(d).expense += t.amount_minor;
      if (t.kind === 'debt_payment') debtPaid += t.amount_minor;
      else if (t.is_essential === false) nonEssential += t.amount_minor; else essential += t.amount_minor;
      for (const a of catAmounts(t)) { const n = catName(a.category_id, t); byCat.set(n, (byCat.get(n) ?? 0) + a.amount); }
      const m = t.payment_method || 'Unspecified'; byMethod.set(m, (byMethod.get(m) ?? 0) + t.amount_minor);
    }
  }
  const net = income - expense;
  return {
    income, expense, net, essential, nonEssential, debtPaid,
    savingsRate: income > 0 ? (net / income) * 100 : null,
    byCat: sortMap(byCat), incCat: sortMap(incCat), incSrc: sortMap(incSrc), byMethod: sortMap(byMethod),
    byDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
  };
}
export const sortMap = (m: Map<string, number>) => [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
export const signed = (t: Txn) => t.signed_amount_minor;
export const pctChange = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

/** Daily Spending Allowance = Money available for planned spending / remaining budgeted days (incl. today). */
export function allowance(funds: number, reserves: number, remainingDays: number) {
  return Math.max(0, Math.floor((funds - reserves) / Math.max(1, remainingDays)));
}
export function payoffMonths(balance: number, annualBps: number | null, payment: number | null): number | null {
  if (!payment || payment <= 0 || balance <= 0) return null;
  const r = (annualBps ?? 0) / 10000 / 12;
  if (r === 0) return Math.ceil(balance / payment);
  if (payment <= balance * r) return null;
  return Math.ceil(-Math.log(1 - (balance * r) / payment) / Math.log(1 + r));
}
