export function exponent(cur: string): number {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits ?? 2; }
  catch { return 2; }
}
/** Parse "1,234.50" into minor units without floating point. Returns null if invalid. */
export function parseMinor(input: string, cur: string): number | null {
  const e = exponent(cur);
  const s = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [i, f = ''] = s.split('.');
  if (f.length > e) return null;
  const v = Number(i) * 10 ** e + Number((f || '').padEnd(e, '0') || 0);
  return Number.isSafeInteger(v) ? v : null;
}
export const toMajor = (m: number, cur: string) => m / 10 ** exponent(cur);
export const inputValue = (m: number, cur: string) => toMajor(m, cur).toFixed(exponent(cur));
export function formatMoney(m: number, cur: string, compact = false) {
  const e = exponent(cur);
  return new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: cur, minimumFractionDigits: compact ? 0 : e, maximumFractionDigits: compact ? 0 : e,
  }).format(m / 10 ** e);
}
export const CURRENCIES = ['KES','USD','EUR','GBP','UGX','TZS','RWF','ETB','ZAR','NGN','GHS','INR','AED','CAD','AUD','JPY'];
