'use client';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCheck } from 'lucide-react';
import { useApp, useLoad } from '@/components/app-provider';
import { NotifPrefs } from '@/components/notif-prefs';
import { Button, Card, CardBody, CardHeader, Empty, Loading, PageHeader } from '@/components/ui';
import { errMsg, cn } from '@/lib/utils';
import type { Notif } from '@/lib/types';

export default function Notifications() {
  const { sb, tz, refresh } = useApp();
  const { data, loading, error } = useLoad(async () => { const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100); if (error) throw error; return data as Notif[]; }, []);
  async function read(id: string) { const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); if (error) return void toast.error(errMsg(error)); refresh(); }
  async function readAll() { const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null); if (error) return void toast.error(errMsg(error)); refresh(); }
  const unread = data?.filter((n) => !n.read_at).length ?? 0;
  return (
    <>
      <PageHeader title="Notifications" actions={<Button variant="outline" disabled={!unread} onClick={readAll}><CheckCheck className="h-4 w-4" />Mark all as read</Button>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>{loading && !data ? <div className="p-4"><Loading /></div> : error ? <Empty title="Could not load" hint={error} /> : !data?.length ? <Empty title="You're all caught up" hint="Alerts about budgets, bills, debts and goals appear here." /> : (
          <ul className="divide-y divide-border">{data.map((n) => (
            <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3', !n.read_at && 'bg-primary/5')}>
              <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-primary')} />
              <div className="min-w-0 flex-1"><div className="text-sm font-medium">{n.link ? <Link href={n.link} onClick={() => !n.read_at && read(n.id)} className="hover:underline">{n.title}</Link> : n.title}</div>{n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}<p className="mt-0.5 text-xs text-muted-foreground">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(n.created_at))}</p></div>
              {!n.read_at && <Button size="sm" variant="ghost" onClick={() => read(n.id)}>Mark read</Button>}
            </li>))}</ul>)}</Card>
        <Card><CardHeader title="Preferences" /><CardBody><NotifPrefs /></CardBody></Card>
      </div>
    </>
  );
}
