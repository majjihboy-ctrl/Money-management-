'use client';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { useApp } from './app-provider';
import { Empty } from './ui';

export const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
type Series = { key: string; name?: string; color: string };
const tick = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };
const tip = { contentStyle: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }, labelStyle: { color: 'hsl(var(--foreground))' } };

export function Bars({ data, series, height = 240, stacked }: { data: Record<string, string | number>[]; series: Series[]; height?: number; stacked?: boolean }) {
  const { money } = useApp();
  if (!data.length) return <Empty title="No data for this period" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={tick} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        <Tooltip {...tip} formatter={(v: number) => money.fmtMajor(v)} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={s.color} radius={[6, 6, 0, 0]} stackId={stacked ? 'a' : undefined} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
export function Lines({ data, series, height = 240 }: { data: Record<string, string | number>[]; series: Series[]; height?: number }) {
  const { money } = useApp();
  if (!data.length) return <Empty title="No data for this period" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={tick} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        <Tooltip {...tip} formatter={(v: number) => money.fmtMajor(v)} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color} strokeWidth={2.5} dot={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
export function Pie1({ data, height = 200, center }: { data: { name: string; value: number }[]; height?: number; center?: string }) {
  const { money } = useApp();
  if (!data.length) return <Empty title="No data for this period" />;
  const total = data.reduce((a, x) => a + x.value, 0);
  return (
    <div>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={3} cornerRadius={6} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip {...tip} formatter={(v: number) => money.fmtMajor(v)} />
          </PieChart>
        </ResponsiveContainer>
        {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xs text-muted-foreground">{center}</span><span className="num text-lg font-semibold">{money.fmtMajor(total)}</span></div>}
      </div>
      <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {data.map((x, i) => (
          <li key={x.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="truncate">{x.name}</span></span>
            <span className="num shrink-0 text-muted-foreground">{total ? Math.round((x.value / total) * 100) : 0}%</span>
          </li>))}
      </ul>
    </div>
  );
}
