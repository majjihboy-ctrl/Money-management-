'use client';
import { Plus } from 'lucide-react';
import { TxnBrowser } from '@/components/txn-browser';
import { useQuickAdd } from '@/components/quick-add';
import { Button, PageHeader } from '@/components/ui';
export default function Page() {
  const qa = useQuickAdd();
  return <><PageHeader title="Expenses" desc="Track where your money goes." actions={<Button onClick={() => qa.open('expense')}><Plus className="h-4 w-4" />Add expense</Button>} /><TxnBrowser kinds={['expense']} fixedType="expense" /></>;
}
