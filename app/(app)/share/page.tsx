'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/components/app-provider';
import { MpesaImportModal } from '@/components/mpesa-import';
import { Empty, Loading } from '@/components/ui';

// Target of the phone's Share sheet: share an M-Pesa SMS to this app and it opens the importer with the text filled in.
function Inner() {
  const { accounts } = useApp(); const router = useRouter(); const sp = useSearchParams();
  const text = [sp.get('title'), sp.get('text'), sp.get('url')].filter(Boolean).join('\n').trim();
  const live = accounts.filter((a) => !a.archived_at);
  const acc = live.find((a) => a.type === 'mobile_money') ?? live[0];
  const close = () => router.replace('/dashboard');
  if (!acc) return <Empty title="Add an account first" hint="Create an M-Pesa account, then share your messages to this app again." />;
  if (!text) return <Empty title="Nothing was shared" hint="Select an M-Pesa message, tap Share, and choose Money." />;
  return <MpesaImportModal acc={acc} initialText={text} onClose={close} />;
}
export default function Share() { return <Suspense fallback={<Loading />}><Inner /></Suspense>; }
