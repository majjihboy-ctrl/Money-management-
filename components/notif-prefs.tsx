'use client';
import { toast } from 'sonner';
import { useApp } from './app-provider';
import { Toggle } from './ui';
import { errMsg } from '@/lib/utils';
const ITEMS: [string, string][] = [['daily_limit', 'Daily spending limit exceeded'], ['budget', 'Budget approaching or over its limit'], ['bills', 'Upcoming bills'], ['debts', 'Upcoming debt repayments'], ['goals', 'Savings goal milestones'], ['recurring', 'Recurring transaction due dates'], ['high_spending', 'Unusually high spending']];
export function NotifPrefs() {
  const { sb, profile, refresh } = useApp();
  async function set(k: string, v: boolean) {
    const { error } = await sb.from('profiles').update({ notification_prefs: { ...profile.notification_prefs, [k]: v } }).eq('id', profile.id);
    if (error) return void toast.error(errMsg(error)); refresh();
  }
  return <div>{ITEMS.map(([k, l]) => <Toggle key={k} label={l} checked={profile.notification_prefs?.[k] !== false} onChange={(v) => set(k, v)} />)}<p className="mt-2 text-xs text-muted-foreground">In-app notifications only. Email, SMS and push reminders are not enabled in this deployment.</p></div>;
}
