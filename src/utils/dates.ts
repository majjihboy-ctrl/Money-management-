import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
  subMonths,
} from 'date-fns';
import type { PeriodFilter } from '../types';

export function getPeriodRange(
  period: PeriodFilter,
  reference: Date = new Date()
): { from: string; to: string; label: string } {
  let from: Date;
  let to: Date;

  switch (period) {
    case 'week':
      from = startOfWeek(reference, { weekStartsOn: 1 });
      to = endOfWeek(reference, { weekStartsOn: 1 });
      break;
    case 'month':
      from = startOfMonth(reference);
      to = endOfMonth(reference);
      break;
    case 'quarter':
      from = startOfQuarter(reference);
      to = endOfQuarter(reference);
      break;
    case 'year':
      from = startOfYear(reference);
      to = endOfYear(reference);
      break;
    default:
      from = startOfMonth(reference);
      to = endOfMonth(reference);
  }

  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
    label: format(from, 'MMM d') + ' – ' + format(to, 'MMM d, yyyy'),
  };
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function currentMonthStartEnd(): { from: string; to: string } {
  const now = new Date();
  return {
    from: format(startOfMonth(now), 'yyyy-MM-dd'),
    to: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
}
