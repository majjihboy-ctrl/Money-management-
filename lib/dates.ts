import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
export type Range = { from: string; to: string };
export type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'year' | 'custom';
export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' }, { id: 'last_month', label: 'Last month' }, { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom' },
];
const ms = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const todayStr = (tz: string) => formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
export const addDays = (s: string, n: number) => new Date(ms(s) + n * 864e5).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 864e5);
export const dow = (s: string) => new Date(ms(s)).getUTCDay();
export const startOfWeek = (s: string) => addDays(s, -((dow(s) + 6) % 7));
export const startOfMonth = (s: string) => s.slice(0, 8) + '01';
export const endOfMonth = (s: string) => { const [y, m] = s.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
export const addMonths = (s: string, n: number) => { const [y, m] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10); };
export const startOfYear = (s: string) => s.slice(0, 4) + '-01-01';
export const endOfYear = (s: string) => s.slice(0, 4) + '-12-31';
export const eachDay = (from: string, to: string) => { const out: string[] = []; for (let d = from; d <= to && out.length < 4000; d = addDays(d, 1)) out.push(d); return out; };
export function presetRange(p: Preset, tz: string, custom?: Range): Range {
  const t = todayStr(tz);
  switch (p) {
    case 'today': return { from: t, to: t };
    case 'yesterday': { const y = addDays(t, -1); return { from: y, to: y }; }
    case 'week': return { from: startOfWeek(t), to: addDays(startOfWeek(t), 6) };
    case 'month': return { from: startOfMonth(t), to: endOfMonth(t) };
    case 'last_month': { const l = addMonths(startOfMonth(t), -1); return { from: l, to: endOfMonth(l) }; }
    case 'year': return { from: startOfYear(t), to: endOfYear(t) };
    default: return custom ?? { from: startOfMonth(t), to: t };
  }
}
export const instants = (from: string, to: string | undefined, tz: string) => ({
  start: fromZonedTime(`${from}T00:00:00`, tz).toISOString(),
  end: to ? fromZonedTime(`${addDays(to, 1)}T00:00:00`, tz).toISOString() : undefined,
});
export const dayOf = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, 'yyyy-MM-dd');
export const fmtDate = (iso: string, tz: string, p = 'd MMM yyyy') => formatInTimeZone(new Date(iso), tz, p);
export const fmtDay = (s: string, p = 'EEE d MMM') => formatInTimeZone(new Date(ms(s)), 'UTC', p);
export const toLocalInput = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd'T'HH:mm");
export const fromLocalInput = (v: string, tz: string) => fromZonedTime(v, tz).toISOString();
export const nowLocalInput = (tz: string) => formatInTimeZone(new Date(), tz, "yyyy-MM-dd'T'HH:mm");
export function occurrenceDate(start: string, freq: string, n: number, every: number): string {
  switch (freq) {
    case 'weekly': return addDays(start, 7 * n * every);
    case 'biweekly': return addDays(start, 14 * n * every);
    case 'monthly': case 'quarterly': {
      const k = (freq === 'quarterly' ? 3 : 1) * n * every; const [y, m, d] = start.split('-').map(Number);
      const first = new Date(Date.UTC(y, m - 1 + k, 1)); const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
    }
    case 'annual': { const [y, m, d] = start.split('-').map(Number); const last = new Date(Date.UTC(y + n * every, m, 0)).getUTCDate();
      return new Date(Date.UTC(y + n * every, m - 1, Math.min(d, last))).toISOString().slice(0, 10); }
    default: return addDays(start, n * every);
  }
}
