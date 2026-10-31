import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account } from './types';
import { uuid } from './utils';

/** Post a deposit/withdrawal so the account balance equals the real balance (diff = actual - app). */
export async function postAdjustment(sb: SupabaseClient, acc: Account, diff: number, mobile: boolean) {
  if (!diff) return;
  const payload = { id: uuid(), kind: diff > 0 ? 'deposit' : 'withdrawal', account_id: acc.id, amount_minor: Math.abs(diff), occurred_at: new Date().toISOString(),
    description: 'Balance adjustment (reconciled with actual balance)', payment_method: mobile ? 'M-Pesa' : null, is_recurring: false };
  const { error } = await sb.rpc('save_transaction', { p: payload, p_splits: [] });
  if (error) throw error;
}
