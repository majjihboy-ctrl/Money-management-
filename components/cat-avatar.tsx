import { ArrowDownLeft, ArrowLeftRight, Banknote, Car, Clapperboard, GraduationCap, HeartPulse, Home, PiggyBank, Receipt, ShoppingBag, Smartphone, UtensilsCrossed, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const RULES: [RegExp, LucideIcon, string][] = [
  [/food|grocer|eat|restaurant|meal|lunch|dinner|snack/i, UtensilsCrossed, 'bg-orange-500/15 text-orange-600 dark:text-orange-400'],
  [/transport|fuel|matatu|uber|bolt|fare|taxi|car/i, Car, 'bg-sky-500/15 text-sky-600 dark:text-sky-400'],
  [/rent|house|housing|home/i, Home, 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'],
  [/airtime|data|internet|wifi|phone|mobile/i, Smartphone, 'bg-violet-500/15 text-violet-600 dark:text-violet-400'],
  [/health|medic|pharma|hospital|clinic/i, HeartPulse, 'bg-rose-500/15 text-rose-600 dark:text-rose-400'],
  [/school|fees|educat|book|course/i, GraduationCap, 'bg-amber-500/15 text-amber-600 dark:text-amber-400'],
  [/shop|cloth|fashion|personal/i, ShoppingBag, 'bg-pink-500/15 text-pink-600 dark:text-pink-400'],
  [/entertain|fun|movie|game|bet/i, Clapperboard, 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400'],
  [/bill|util|electric|water|kplc|power/i, Zap, 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'],
  [/salary|wage|income|business|sales|pay/i, Banknote, 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'],
  [/saving/i, PiggyBank, 'bg-teal-500/15 text-teal-600 dark:text-teal-400'],
];

/** Round icon badge for a transaction row, chosen from the category name and kind. */
export function CatAvatar({ name, kind, className }: { name: string; kind?: string; className?: string }) {
  let Icon: LucideIcon = Receipt, tone = 'bg-muted text-muted-foreground';
  if (kind === 'transfer_in' || kind === 'transfer_out') { Icon = ArrowLeftRight; tone = 'bg-blue-500/15 text-blue-600 dark:text-blue-400'; }
  else {
    const hit = RULES.find(([re]) => re.test(name));
    if (hit) { Icon = hit[1]; tone = hit[2]; }
    else if (kind === 'income' || kind === 'deposit' || kind === 'debt_collection') { Icon = ArrowDownLeft; tone = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'; }
  }
  return <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tone, className)} aria-hidden><Icon className="h-5 w-5" /></span>;
}
