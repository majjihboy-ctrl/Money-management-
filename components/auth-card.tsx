import { Wallet2 } from 'lucide-react';
export function AuthCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="hero mb-5 flex h-16 w-16 items-center justify-center rounded-3xl shadow-fab"><Wallet2 className="relative z-10 h-8 w-8" /></div>
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-6 shadow-card sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">Money Manager Pro</p>
    </div>
  );
}
