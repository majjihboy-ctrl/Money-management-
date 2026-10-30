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
 * Completes onboarding:
 * - Upsert profile (create if missing — trigger may not have run)
 * - Create first account
 * - Seed categories
 */
export async function completeOnboarding(
  userId: string,
  payload: OnboardingPayload
): Promise<{ profile: Profile; accountId: string }> {
  if (!isSupabaseConfigured) {
    throw new Error('Backend not configured. Supabase keys missing.');
  }

  const opening = money(payload.openingBalance || '0');
  const name = payload.preferredName.trim() || 'Friend';
  const currency = payload.defaultCurrency || 'KES';

  // 1. Ensure profile exists, then mark onboarding complete
  const { data: existing, error: fetchErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`Could not load profile: ${fetchErr.message}`);
  }

  let profile: Profile;

  if (!existing) {
    const { data: inserted, error: insertErr } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        preferred_name: name,
        display_name: name,
        default_currency: currency,
        salary_day: payload.salaryDay,
        timezone: payload.timezone || 'Africa/Nairobi',
        country: 'KE',
        onboarding_completed: true,
      })
      .select()
      .single();

    if (insertErr) {
      throw new Error(
        `Could not create profile: ${insertErr.message}. Check RLS and that the profiles table exists (run APPLY_ALL.sql).`
      );
    }
    profile = inserted as Profile;
  } else {
    const { data: updated, error: updateErr } = await supabase
      .from('profiles')
      .update({
        preferred_name: name,
        display_name: name,
        default_currency: currency,
        salary_day: payload.salaryDay,
        timezone: payload.timezone || 'Africa/Nairobi',
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Could not update profile: ${updateErr.message}`);
    }
    profile = updated as Profile;
  }

  // 2. First account (skip if user already has one)
  const { data: existingAccounts, error: accListErr } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .limit(1);

  if (accListErr) {
    throw new Error(`Could not list accounts: ${accListErr.message}`);
  }

  let accountId: string;
  if (existingAccounts && existingAccounts.length > 0) {
    accountId = existingAccounts[0].id;
  } else {
    try {
      const account = await createAccount(userId, {
        name: payload.accountName.trim() || 'Cash',
        type: payload.accountType || 'cash',
        currency,
        opening_balance: opening,
      });
      accountId = account.id;
    } catch (e: any) {
      throw new Error(`Could not create account: ${e?.message || e}`);
    }
  }

  // 3. Categories (non-fatal if already seeded / partial failure)
  try {
    await seedDefaultCategories(userId);
  } catch (e: any) {
    console.warn('Category seed failed (continuing):', e?.message || e);
  }

  return { profile, accountId };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as Profile) || null;
}
