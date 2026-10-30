import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, Debt, Goal, Occurrence, Profile, Rule } from './types';
import { addDays, fmtDay, todayStr } from './dates';
import { fetchTxns, goalProgress, loadBudgets } from './queries';
import { loadDaily } from './daily';
import { formatMoney } from './money';

type N = { kind: string; title: string; body: string; link: string; dedupe_key: string };
/** Generates in-app notifications. Idempotent via (user_id, dedupe_key). */
export async function syncNotifications(sb: SupabaseClient, profile: Profile, accounts: Account[]) {
  const tz = profile.timezone, cur = profile.currency, f = (m: number) => formatMoney(m, cur);
  const p = profile.notification_prefs ?? {}; const today = todayStr(tz); const soon = addDays(today, 3);
  const out: N[] = [];

  if (p.budget !== false) {
    for (const b of await loadBudgets(sb, tz, today)) {
      for (const t of [...b.thresholds].sort((a, c) => a - c)) if (b.pct >= t)
        out.push({ kind: 'budget', title: t >= 100 ? `Budget exceeded: ${b.name}` : `${t}% of budget used: ${b.name}`, body: `${f(b.spent)} of ${f(b.amount_minor)} spent.`, link: '/budgets', dedupe_key: `budget:${b.id}:${t}:${b.start_date}` });
    }
  }
  if (p.daily_limit !== false) {
    const d = await loadDaily(sb, tz, accounts, today);
    const spent = d.dayTxns.filter((t) => t.kind === 'expense' || t.kind === 'debt_payment').reduce((s, t) => s + t.amount_minor, 0);
    if (d.limit > 0 && spent > d.limit) out.push({ kind: 'daily_limit', title: 'Daily spending limit exceeded', body: `You spent ${f(spent)} against a limit of ${f(d.limit)} today.`, link: '/daily', dedupe_key: `daily:${today}` });
    if (p.high_spending !== false) {
      const hist = await fetchTxns(sb, tz, addDays(today, -60), undefined, { kinds: ['expense'] });
      const prior = hist.filter((t) => !d.dayTxns.some((x) => x.id === t.id));
      if (prior.length >= 8) {
        const avg = prior.reduce((s, t) => s + t.amount_minor, 0) / prior.length;
        for (const t of d.dayTxns) if (t.kind === 'expense' && t.amount_minor > avg * 4)
          out.push({ kind: 'high_spending', title: 'Unusually high expense', body: `${f(t.amount_minor)} is much higher than your typical expense of ${f(Math.round(avg))}.`, link: '/transactions', dedupe_key: `high:${t.id}` });
      }
    }
  }
  if (p.bills !== false || p.recurring !== false) {
    const [{ data: occ }, { data: rules }] = await Promise.all([
      sb.from('recurring_occurrences').select('*').eq('state', 'pending').lte('due_date', soon),
      sb.from('recurring_rules').select('*'),
    ]);
    const rm = new Map(((rules ?? []) as Rule[]).map((r) => [r.id, r]));
    for (const o of (occ ?? []) as Occurrence[]) {
      const r = rm.get(o.rule_id); if (!r) continue;
      out.push({ kind: 'bill', title: o.due_date < today ? `Overdue: ${r.name}` : `Due ${o.due_date === today ? 'today' : fmtDay(o.due_date)}: ${r.name}`, body: `${f(r.amount_minor)} ${r.kind === 'income' ? 'expected' : 'to pay'}.`, link: '/bills', dedupe_key: `bill:${o.id}` });
    }
  }
  if (p.debts !== false) {
    const { data } = await sb.from('debts').select('*').eq('status', 'active').not('due_date', 'is', null).lte('due_date', soon);
    for (const d of (data ?? []) as Debt[]) out.push({ kind: 'debt', title: d.direction === 'payable' ? `Debt payment due: ${d.counterparty}` : `Repayment expected from ${d.counterparty}`, body: `Due ${fmtDay(d.due_date!)}. Outstanding ${f(d.outstanding_minor)}.`, link: '/debts', dedupe_key: `debt:${d.id}:${d.due_date}` });
  }
  if (p.goals !== false) {
    const [{ data: goals }, gp] = await Promise.all([sb.from('savings_goals').select('*').in('status', ['active', 'completed']), goalProgress(sb)]);
    for (const g of (goals ?? []) as Goal[]) {
      const pct = ((gp[g.id] ?? 0) / g.target_minor) * 100;
      for (const m of [25, 50, 75, 100]) if (pct >= m) out.push({ kind: 'goal', title: m === 100 ? `Goal reached: ${g.name}` : `${m}% of "${g.name}" saved`, body: `${f(gp[g.id] ?? 0)} of ${f(g.target_minor)}.`, link: '/savings', dedupe_key: `goal:${g.id}:${m}` });
    }
  }
  if (out.length) await sb.from('notifications').upsert(out, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
}
