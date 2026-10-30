'use client';
import { PRESETS, presetRange, type Preset } from '@/lib/dates';
import { Input } from './ui';
import { cn } from '@/lib/utils';

export type FilterState = { preset: Preset; from: string; to: string };
export const initFilter = (tz: string, preset: Preset = 'month'): FilterState => ({ preset, ...presetRange(preset, tz) });
export const filterLabel = (f: FilterState) => PRESETS.find((p) => p.id === f.preset)?.label ?? 'Custom';

export function DateFilter({ value, onChange, tz }: { value: FilterState; onChange: (f: FilterState) => void; tz: string }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => onChange(p.id === 'custom' ? { preset: 'custom', from: value.from, to: value.to } : { preset: p.id, ...presetRange(p.id, tz) })}
            className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium', value.preset === p.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted')}>{p.label}</button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Input type="date" className="w-40" value={value.from} max={value.to} aria-label="From" onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
          <span className="text-muted-foreground">to</span>
          <Input type="date" className="w-40" value={value.to} min={value.from} aria-label="To" onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
