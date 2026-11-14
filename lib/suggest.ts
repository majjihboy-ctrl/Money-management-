import type { Rule, Txn } from './types';
import { addDays, dayOf, daysBetween, occurrenceDate } from './dates';

export type Suggestion = { key: string; name: string; amount_minor: number; frequency: 'weekly' | 'monthly'; count: number; last: string; next: string; account_id: string; category_id: string | null; counterparty: string | null };
const norm = (s: string) => s.toLowerCase().replace(/[0-9]+/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Finds expenses that repeat on a steady weekly or monthly rhythm with similar amounts and are not already recurring items. */
export function suggestRecurring(txns: Txn[], rules: Rule[], tz: string): Suggestion[] {
  const known = rules.map((r) => norm(r.name));
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.kind !== 'expense' || t.is_recurring) continue;
    const k = norm(t.counterparty || t.description || ''); if (k.length < 3) continue;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
  }
  const out: Suggestion[] = [];
  for (const [key, list] of groups) {
    if (list.length < 3 || known.some((n) => n && (n.includes(key) || key.includes(n)))) continue;
    const rows = list.map((t) => ({ t, d: dayOf(t.occurred_at, tz) })).sort((a, b) => a.d.localeCompare(b.d));
    const gaps = rows.slice(1).map((r, i) => daysBetween(rows[i].d, r.d));
    const g = median(gaps); const amt = median(rows.map((r) => r.t.amount_minor));
    const steady = (lo: number, hi: number) => g >= lo + 2 && g <= hi - 2 && gaps.every((x) => x >= lo && x <= hi);
    const frequency = steady(20, 40) ? 'monthly' : steady(5, 9) ? 'weekly' : null;
    if (!frequency || !rows.every((r) => Math.abs(r.t.amount_minor - amt) <= amt * 0.15)) continue;
    const last = rows[rows.length - 1]; const lastDay = last.d;
    const next = frequency === 'monthly' ? occurrenceDate(lastDay, 'monthly', 1, 1) : addDays(lastDay, 7);
    out.push({ key, name: (last.t.counterparty || last.t.description || key).trim(), amount_minor: Math.round(amt), frequency, count: rows.length, last: lastDay, next, account_id: last.t.account_id, category_id: last.t.category_id, counterparty: last.t.counterparty });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 4);
}
