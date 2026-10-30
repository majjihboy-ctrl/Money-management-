import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

const TABLES = ['profiles', 'accounts', 'categories', 'transactions', 'transaction_splits', 'transfers', 'attachments', 'budgets', 'spending_plans', 'savings_goals', 'savings_entries', 'debts', 'debt_payments', 'recurring_rules', 'recurring_occurrences', 'notifications', 'audit_log'];
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!rateLimit(`exp:${user.id}`, 5, 600_000)) return NextResponse.json({ error: 'Too many exports. Try again shortly.' }, { status: 429 });
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user: { id: user.id, email: user.email } };
  for (const t of TABLES) {
    const rows: unknown[] = [];
    for (let p = 0; p < 100; p++) { const { data, error } = await sb.from(t).select('*').range(p * 1000, p * 1000 + 999); if (error) break; rows.push(...(data ?? [])); if (!data || data.length < 1000) break; }
    out[t] = rows; // RLS guarantees only this user's rows
  }
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="money-manager-export-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } });
}
