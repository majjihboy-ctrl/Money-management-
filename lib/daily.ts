import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, Debt, Goal, Occurrence, Plan, Rule, Txn } from './types';
import { addDays, dayOf, daysBetween, endOfMonth, startOfWeek, todayStr } from './dates';
import { allowance, isExpense } from './calc';
import { balances, fetchTxns, goalProgress } from './queries';

export const planPeriodEnd = (plan: Plan, date: string) => {
  switch (plan.period) {
    case 'daily': return date;
    case 'weekly': return addDays(startOfWeek(date), 6);
    case 'annual': return date.slice(0, 4) + '-12-31';
    case 'custom': return plan.period_end && plan.period_end >= date ? plan.period_end : date;
    default: return endOfMonth(date);
  }
};

export async function loadDaily(sb: SupabaseClient, tz: string, accounts: Account[], date: string) {
  const { data: planRow } = await sb.from('spending_plans').select('*').maybeSingle();
  const plan: Plan = planRow ?? { user_id: '', mode: 'manual', manual_daily_limit_minor: 0, period: 'monthly', period_start: null, period_end: null, deduct_bills: true, deduct_savings: true, deduct_debts: true, extra_reserve_minor: 0 };
  const spendIds = new Set(accounts.filter((a) => !a.archived_at && a.type !== 'savings').map((a) => a.id));
  const bal = await balances(sb);
  const since = await fetchTxns(sb, tz, date);
  const spendSince = since.filter((t) => spendIds.has(t.account_id));
  const dayTx = since.filter((t) => dayOf(t.occurred_at, tz) === date);
  const current = [...spendIds].reduce((s, id) => s + (bal[id] ?? 0), 0);
  const opening = current - spendSince.reduce((s, t) => s + t.signed_amount_minor, 0);
  const end = planPeriodEnd(plan, date);
  const remainingDays = Math.max(1, daysBetween(date, end) + 1);

  let bills = 0, debts = 0, savings = 0;
  if (plan.mode === 'auto') {
    if (plan.deduct_bills) {
      const [{ data: occ }, { data: rules }] = await Promise.all([
        sb.from('recurring_occurrences').select('*').eq('state', 'pending').gte('due_date', date).lte('due_date', end),
        sb.from('recurring_rules').select('*').eq('kind', 'expense'),
      ]);
      const rm = new Map((rules ?? []).map((r: Rule) => [r.id, r]));
      bills = ((occ ?? []) as Occurrence[]).reduce((s, o) => s + (rm.get(o.rule_id)?.amount_minor ?? 0), 0);
    }
    if (plan.deduct_debts) {
      const { data } = await sb.from('debts').select('*').eq('direction', 'payable').eq('status', 'active').gte('due_date', date).lte('due_date', end);
      debts = ((data ?? []) as Debt[]).reduce((s, d) => s + Math.min(d.min_payment_minor ?? 0, d.outstanding_minor), 0);
    }
    if (plan.deduct_savings) {
      const [{ data: goals }, gp] = await Promise.all([sb.from('savings_goals').select('*').eq('status', 'active').is('linked_account_id', null), goalProgress(sb)]);
      savings = ((goals ?? []) as Goal[]).reduce((s, g) => s + (gp[g.id] ?? 0), 0);
    }
  }
  const reserves = bills + debts + savings + (plan.mode === 'auto' ? plan.extra_reserve_minor : 0);
  const limit = plan.mode === 'manual' ? plan.manual_daily_limit_minor : allowance(opening, reserves, remainingDays);
  return { plan, opening, current, end, remainingDays, bills, debts, savings, reserves, limit, dayTxns: dayTx as Txn[], expenseKinds: isExpense, today: todayStr(tz) };
}
