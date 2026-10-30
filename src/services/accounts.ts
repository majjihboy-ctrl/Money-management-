import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { money } from '../lib/money';
import type { Account, AccountType } from '../types';

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  currency: string;
  opening_balance: string;
  color?: string;
  icon?: string;
}

export async function createAccount(userId: string, input: CreateAccountInput): Promise<Account> {
  if (!isSupabaseConfigured) throw new Error('Backend not configured');

  const opening = money(input.opening_balance);
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      type: input.type,
      currency: input.currency,
      opening_balance: opening,
      current_balance: opening,
      color: input.color ?? null,
      icon: input.icon ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

export async function listAccounts(userId: string, includeArchived = false): Promise<Account[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase.from('accounts').select('*').eq('user_id', userId);
  if (!includeArchived) q = q.eq('is_archived', false);
  const { data, error } = await q.order('name');
  if (error) throw error;
  return (data || []) as Account[];
}
