import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { add, money, percentOf, subtract } from '../lib/money';
import type { Budget, BudgetCategory, Transaction } from '../types';
import { currentMonthStartEnd } from '../utils/dates';

export interface BudgetProgress {
  budgetId: string;
  name: string;
  overallLimit: string | null;
  overallSpent: string;
  overallRemaining: string;
  overallPercent: number;
  categories: {
    categoryId: string;
    categoryName: string;
    limit: string;
    spent: string;
    remaining: string;
    percent: number;
    color: string | null;
  }[];
}

/**
 * Compute spent amounts for a budget period.
 * IMPORTANT: transfers are excluded — they are internal movements.
 */
export async function getBudgetProgress(
  userId: string,
  budget: Budget,
  categoryNames: Map<string, { name: string; color: string | null }>
): Promise<BudgetProgress> {
  const from = budget.start_date;
  const to = budget.end_date || currentMonthStartEnd().to;

  // Fetch expenses in period (exclude transfers)
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('amount, category_id, type')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('date', from)
    .lte('date', to)
    .in('type', ['expense', 'debt_payment']);

  if (error) throw error;

  const spentByCategory = new Map<string, string>();
  let overallSpent = '0.00';

  for (const tx of (txs || []) as Pick<Transaction, 'amount' | 'category_id' | 'type'>[]) {
    overallSpent = add(overallSpent, tx.amount);
    if (tx.category_id) {
      const prev = spentByCategory.get(tx.category_id) || '0.00';
      spentByCategory.set(tx.category_id, add(prev, tx.amount));
    }
  }

  // Load budget category limits
  const { data: budgetCats } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('budget_id', budget.id);

  const categories = ((budgetCats || []) as BudgetCategory[]).map((bc) => {
    const spent = spentByCategory.get(bc.category_id) || '0.00';
    const limit = money(bc.limit_amount);
    const remaining = subtract(limit, spent);
    const meta = categoryNames.get(bc.category_id) || { name: 'Unknown', color: null };
    return {
      categoryId: bc.category_id,
      categoryName: meta.name,
      limit,
      spent,
      remaining,
      percent: percentOf(spent, limit),
      color: meta.color,
    };
  });

  const overallLimit = budget.overall_limit ? money(budget.overall_limit) : null;
  const overallRemaining = overallLimit ? subtract(overallLimit, overallSpent) : '0.00';
  const overallPercent = overallLimit ? percentOf(overallSpent, overallLimit) : 0;

  return {
    budgetId: budget.id,
    name: budget.name,
    overallLimit,
    overallSpent,
    overallRemaining,
    overallPercent,
    categories,
  };
}

export async function listBudgets(userId: string): Promise<Budget[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data || []) as Budget[];
}

/** Create a simple monthly budget for the current month with optional overall limit. */
export async function createMonthlyBudget(
  userId: string,
  name: string,
  overallLimit: string | null,
  categoryLimits: { categoryId: string; limit: string }[] = []
): Promise<Budget> {
  if (!isSupabaseConfigured) throw new Error('Backend not configured');
  const { from, to } = currentMonthStartEnd();

  const { data: budget, error } = await supabase
    .from('budgets')
    .insert({
      user_id: userId,
      name,
      period: 'monthly',
      start_date: from,
      end_date: to,
      overall_limit: overallLimit ? money(overallLimit) : null,
      rollover_enabled: false,
    })
    .select()
    .single();

  if (error) throw error;

  if (categoryLimits.length > 0) {
    await supabase.from('budget_categories').insert(
      categoryLimits.map((c) => ({
        budget_id: budget.id,
        category_id: c.categoryId,
        limit_amount: money(c.limit),
      }))
    );
  }

  return budget as Budget;
}
