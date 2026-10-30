/**
 * Money utilities — NEVER use native JS number for financial math.
 * All amounts are string decimals. Internal math uses Decimal.js.
 */
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type Money = string;

export function toDecimal(value: Money | number | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === 'number') {
    // Avoid float contamination when possible
    return new Decimal(value.toString());
  }
  return new Decimal(value || '0');
}

export function money(value: Money | number | Decimal): Money {
  return toDecimal(value).toFixed(2);
}

export function add(a: Money, b: Money): Money {
  return money(toDecimal(a).plus(toDecimal(b)));
}

export function subtract(a: Money, b: Money): Money {
  return money(toDecimal(a).minus(toDecimal(b)));
}

export function multiply(a: Money, b: Money | number): Money {
  return money(toDecimal(a).times(toDecimal(b)));
}

export function divide(a: Money, b: Money | number): Money {
  const d = toDecimal(b);
  if (d.isZero()) throw new Error('Division by zero');
  return money(toDecimal(a).div(d));
}

export function isPositive(a: Money): boolean {
  return toDecimal(a).greaterThan(0);
}

export function isNegative(a: Money): boolean {
  return toDecimal(a).lessThan(0);
}

export function isZero(a: Money): boolean {
  return toDecimal(a).isZero();
}

export function abs(a: Money): Money {
  return money(toDecimal(a).abs());
}

export function compare(a: Money, b: Money): number {
  return toDecimal(a).comparedTo(toDecimal(b));
}

export function max(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b;
}

export function min(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b;
}

export function percentOf(part: Money, whole: Money): number {
  const w = toDecimal(whole);
  if (w.isZero()) return 0;
  return toDecimal(part).div(w).times(100).toNumber();
}

export function formatMoney(
  amount: Money,
  currency: string = 'KES',
  locale: string = 'en-KE',
  options: { showSign?: boolean; hide?: boolean } = {}
): string {
  if (options.hide) return '••••••';
  const num = toDecimal(amount).toNumber();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${money(amount)}`;
  }
}

/** Convert using a rate: amount_in_from * rate = amount_in_to */
export function convert(amount: Money, rate: Money): Money {
  return multiply(amount, rate);
}

export function sum(amounts: Money[]): Money {
  return amounts.reduce((acc, a) => add(acc, a), '0.00');
}
