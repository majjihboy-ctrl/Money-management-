import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { addDays, occurrenceDate, todayStr } from '@/lib/dates';

export const dynamic = 'force-dynamic';
/** Creates PENDING occurrences for the next 60 days for every active rule. It never posts money; users confirm bills in the app. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const a = admin();
  const until = addDays(todayStr('Africa/Nairobi'), 60);
  const { data: rules, error } = await a.from('recurring_rules').select('id,user_id,frequency,interval_count,start_date,end_date').eq('is_active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let created = 0;
  for (const r of rules ?? []) {
    const rows: { user_id: string; rule_id: string; due_date: string }[] = [];
    for (let n = 0; n < 3650; n++) {
      const d = occurrenceDate(r.start_date, r.frequency, n, r.interval_count);
      if (d > until || (r.end_date && d > r.end_date)) break;
      if (d >= addDays(todayStr('Africa/Nairobi'), -60)) rows.push({ user_id: r.user_id, rule_id: r.id, due_date: d });
    }
    if (rows.length) {
      const { data } = await a.from('recurring_occurrences').upsert(rows, { onConflict: 'rule_id,due_date', ignoreDuplicates: true }).select('id');
      created += data?.length ?? 0;
    }
    const { data: nxt } = await a.from('recurring_occurrences').select('due_date').eq('rule_id', r.id).eq('state', 'pending').order('due_date').limit(1);
    await a.from('recurring_rules').update({ next_due_date: nxt?.[0]?.due_date ?? null }).eq('id', r.id);
  }
  return NextResponse.json({ ok: true, rules: rules?.length ?? 0, created });
}
