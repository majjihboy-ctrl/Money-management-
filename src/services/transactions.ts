import { supabase } from '../lib/supabase';
import { money, add, subtract } from '../lib/money';
import type { Transaction, TransactionType } from '../types';

export interface CreateTransactionInput {
  type: TransactionType;
  amount: string;
  currency: string;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  merchant?: string | null;
  notes?: string | null;
  tags?: string[];
  date: string; // YYYY-MM-DD
  time?: string | null;
}

/** Create a normal income/expense/refund. Transfers use createTransfer. */
export async function createTransaction(input: CreateTransactionInput, userId: string): Promise<Transaction> {
  const amount = money(input.amount);
  if (parseFloat(amount) <= 0) throw new Error('Amount must be greater than zero');

  if (input.type === 'transfer') {
    throw new Error('Use createTransfer for transfers');
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: input.type,
      amount,
      currency: input.currency,
      account_id: input.account_id,
      category_id: input.category_id ?? null,
      merchant: input.merchant ?? null,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      date: input.date,
      time: input.time ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  // Update cached balance
  const delta = input.type === 'income' || input.type === 'refund' ? amount : `-${amount}`;
  await adjustAccountBalance(input.account_id, delta);

  return data as Transaction;
}

/** Atomic transfer via DB function — creates paired records, does not count as income/expense. */
export async function createTransfer(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: string,
  currency: string,
  date: string,
  notes?: string
): Promise<string> {
  const amt = money(amount);
  const { data, error } = await supabase.rpc('create_transfer', {
    p_user_id: userId,
    p_from_account_id: fromAccountId,
    p_to_account_id: toAccountId,
    p_amount: parseFloat(amt),
    p_currency: currency,
    p_date: date,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data as string; // pair id
}

export async function updateTransaction(
  id: string,
  userId: string,
  updates: Partial<CreateTransactionInput>
): Promise<Transaction> {
  // For production: fetch old, reverse balance effect, apply new, log audit
  const { data: existing, error: fetchErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (fetchErr || !existing) throw fetchErr || new Error('Transaction not found');

  // Soft approach: only allow non-balance-affecting fields easily; full edit should reverse+reapply
  const { data, error } = await supabase
    .from('transactions')
    .update({
      ...updates,
      amount: updates.amount ? money(updates.amount) : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function softDeleteTransaction(id: string, userId: string): Promise<void> {
  const { data: tx, error: fetchErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();
  if (fetchErr || !tx) throw fetchErr || new Error('Not found');

  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;

  // Reverse balance effect
  if (tx.type === 'income' || tx.type === 'refund') {
    await adjustAccountBalance(tx.account_id, `-${tx.amount}`);
  } else if (tx.type === 'expense' || tx.type === 'debt_payment') {
    await adjustAccountBalance(tx.account_id, tx.amount);
  }
  // Transfers: reverse both sides if pair exists (simplified — full impl loads pair)
}

async function adjustAccountBalance(accountId: string, delta: string) {
  const { data: acc } = await supabase.from('accounts').select('current_balance').eq('id', accountId).single();
  if (!acc) return;
  const newBal = delta.startsWith('-')
    ? subtract(acc.current_balance, delta.slice(1))
    : add(acc.current_balance, delta);
  await supabase.from('accounts').update({ current_balance: newBal }).eq('id', accountId);
}

export async function listTransactions(
  userId: string,
  opts: {
    limit?: number;
    offset?: number;
    accountId?: string;
    type?: TransactionType;
    fromDate?: string;
    toDate?: string;
    search?: string;
  } = {}
): Promise<Transaction[]> {
  let q = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (opts.accountId) q = q.eq('account_id', opts.accountId);
  if (opts.type) q = q.eq('type', opts.type);
  if (opts.fromDate) q = q.gte('date', opts.fromDate);
  if (opts.toDate) q = q.lte('date', opts.toDate);
  if (opts.search) q = q.or(`merchant.ilike.%${opts.search}%,notes.ilike.%${opts.search}%`);
  if (opts.limit) q = q.limit(opts.limit);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit || 50) - 1);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Transaction[];
}

/** Period totals excluding transfers (transfers are internal). */
export async function getPeriodTotals(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<{ income: string; expense: string }> {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('date', fromDate)
    .lte('date', toDate)
    .in('type', ['income', 'expense', 'refund', 'debt_payment']);

  if (error) throw error;

  let income = '0.00';
  let expense = '0.00';
  for (const row of data || []) {
    if (row.type === 'income' || row.type === 'refund') {
      income = add(income, row.amount);
    } else {
      expense = add(expense, row.amount);
    }
  }
  return { income, expense };
}
