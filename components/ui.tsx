'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const bv = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: { default: 'bg-primary text-primary-foreground hover:opacity-90', outline: 'border border-border bg-card hover:bg-muted', ghost: 'hover:bg-muted', destructive: 'bg-destructive text-white hover:opacity-90' },
    size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs', icon: 'h-10 w-10', lg: 'h-12 px-6' },
  }, defaultVariants: { variant: 'default', size: 'default' },
});
export function Button({ className, variant, size, loading, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof bv> & { loading?: boolean }) {
  return <button className={cn(bv({ variant, size }), className)} disabled={p.disabled || loading} {...p}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>;
}
const field = 'w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(field, 'h-10', className)} {...p} />);
Input.displayName = 'Input';
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn(field, 'h-10', className)} {...p} />);
Select.displayName = 'Select';
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, 'min-h-[72px] py-2', className)} {...p} />);
Textarea.displayName = 'Textarea';

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-muted-foreground">{hint}</span>}
      {error && <span role="alert" className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)} {...p} />;
export function CardHeader({ title, action, className }: { title: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between gap-2 px-4 pt-4', className)}><h3 className="text-sm font-semibold">{title}</h3>{action}</div>;
}
export const CardBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('p-4', className)} {...p} />;
const tones = { muted: 'bg-muted text-muted-foreground', success: 'bg-success/15 text-success', warning: 'bg-warning/15 text-warning', danger: 'bg-destructive/15 text-destructive', info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' };
export type Tone = keyof typeof tones;
export const Badge = ({ tone = 'muted', children }: { tone?: Tone; children: React.ReactNode }) => <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
export function Progress({ value, tone = 'success' }: { value: number; tone?: 'success' | 'warning' | 'danger' }) {
  const color = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-destructive' }[tone];
  return <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-2 px-4 py-10 text-center"><Inbox className="h-8 w-8 text-muted-foreground" /><p className="font-medium">{title}</p>{hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}{action}</div>;
}
export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}</div><div className="flex flex-wrap gap-2">{actions}</div></div>;
}
export function Stat({ label, value, sub, tone, icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'success' | 'danger' | 'warning'; icon?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground"><span>{label}</span>{icon}</div>
      <div className={cn('num mt-2 text-xl font-semibold sm:text-2xl', tone === 'success' && 'text-success', tone === 'danger' && 'text-destructive', tone === 'warning' && 'text-warning')}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  React.useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button></div>
        {children}
      </div>
    </div>
  );
}
export function Confirm({ open, title, desc, confirmLabel = 'Delete', onConfirm, onCancel, busy }: { open: boolean; title: string; desc: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant="destructive" loading={busy} onClick={onConfirm}>{confirmLabel}</Button></div>
    </Modal>
  );
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-muted')}>
        <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </label>
  );
}
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return <div className="inline-flex rounded-lg bg-muted p-1" role="tablist">{items.map((i) => <button key={i.id} role="tab" aria-selected={value === i.id} onClick={() => onChange(i.id)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', value === i.id ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{i.label}</button>)}</div>;
}
export const Loading = ({ rows = 3 }: { rows?: number }) => <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
