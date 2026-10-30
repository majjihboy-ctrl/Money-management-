import type { SupabaseClient } from '@supabase/supabase-js';
import type { Txn, Budget, BudgetView } from './types';
import { instants } from './dates';
import { budgetView } from './calc';

export const TXN_SELECT = '*, transaction_splits(category_id, amount_minor)';

export async function fetchTxns(sb: SupabaseClient, tz: string, from: string, to?: string, opt: { kinds?: string[]; accountId?: string } = {}): Promise<Txn[]> {
  const { start, end } = instants(from, to, tz);
  const out: Txn[] = [];
  for (let page = 0; page < 50; page++) {
    let q = sb.from('transactions').select(TXN_SELECT).is('voided_at', null).gte('occurred_at', start)
      .order('occurred_at', { ascending: false }).order('id').range(page * 1000, page * 1000 + 999);
    if (end) q = q.lt('occurred_at', end);
    if (opt.kinds) q = q.in('kind', opt.kinds);
    if (opt.accountId) q = q.eq('account_id', opt.accountId);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as Txn[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadBudgets(sb: SupabaseClient, tz: string, onlyCurrent?: string): Promise<BudgetView[]> {
  let q = sb.from('budgets').select('*').eq('is_active', true).order('start_date', { ascending: false });
  if (onlyCurrent) q = q.lte('start_date', onlyCurrent).gte('end_date', onlyCurrent);
  const { data, error } = await q;
  if (error) throw error;
  const budgets = (data ?? []) as Budget[];
  if (!budgets.length) return [];
  const from = budgets.reduce((m, b) => (b.start_date < m ? b.start_date : m), budgets[0].start_date);
  const to = budgets.reduce((m, b) => (b.end_date > m ? b.end_date : m), budgets[0].end_date);
  const txns = await fetchTxns(sb, tz, from, to, { kinds: ['expense', 'debt_payment'] });
  return budgets.map((b) => budgetView(b, txns, tz));
}

export async function balances(sb: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await sb.from('account_balances').select('account_id, balance_minor');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.account_id as string, Number(r.balance_minor)]));
}
export async function goalProgress(sb: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await sb.from('goal_progress').select('goal_id, current_minor');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.goal_id as string, Number(r.current_minor)]));
}
