'use client';
import { Plus } from 'lucide-react';
import { TxnBrowser } from '@/components/txn-browser';
import { useQuickAdd } from '@/components/quick-add';
import { Button, PageHeader } from '@/components/ui';
export default function Page() {
  const qa = useQuickAdd();
  return <><PageHeader title="Income" desc="Salary, business, freelancing and every other inflow." actions={<Button onClick={() => qa.open('income')}><Plus className="h-4 w-4" />Add income</Button>} /><TxnBrowser kinds={['income']} fixedType="income" /></>;
}
