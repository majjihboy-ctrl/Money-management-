import { Wallet2 } from 'lucide-react';
export function AuthCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2"><Wallet2 className="h-6 w-6 text-primary" /><span className="font-semibold">Money Manager Pro</span></div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
