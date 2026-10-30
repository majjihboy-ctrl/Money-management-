import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createAccount } from './accounts';
import { seedDefaultCategories } from './categories';
import { money } from '../lib/money';
import type { AccountType, Profile } from '../types';

export interface OnboardingPayload {
  preferredName: string;
  defaultCurrency: string;
  accountName: string;
  accountType: AccountType;
  openingBalance: string;
  salaryDay: number | null;
  timezone?: string;
}

/**
 * Completes onboarding in one go:
 * - Updates profile (name, currency, salary day, onboarding_completed)
 * - Creates first account with opening balance
 * - Seeds default categories
 */
export async function completeOnboarding(
  userId: string,
  payload: OnboardingPayload
): Promise<{ profile: Profile; accountId: string }> {
  if (!isSupabaseConfigured) {
    throw new Error('Backend not configured. Set EXPO_PUBLIC_SUPABASE_* in .env');
  }

  const opening = money(payload.openingBalance || '0');

  // 1. Update profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .update({
      preferred_name: payload.preferredName.trim() || null,
      display_name: payload.preferredName.trim() || null,
      default_currency: payload.defaultCurrency || 'KES',
      salary_day: payload.salaryDay,
      timezone: payload.timezone || 'Africa/Nairobi',
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (profileErr) throw profileErr;

  // 2. Create first account
  const account = await createAccount(userId, {
    name: payload.accountName.trim() || 'Cash',
    type: payload.accountType || 'cash',
    currency: payload.defaultCurrency || 'KES',
    opening_balance: opening,
  });

  // 3. Seed categories (idempotent)
  await seedDefaultCategories(userId);

  return { profile: profile as Profile, accountId: account.id };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data as Profile;
}
