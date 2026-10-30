'use client';
import { TxnBrowser } from '@/components/txn-browser';
import { PageHeader } from '@/components/ui';
export default function Page() { return <><PageHeader title="Transactions" desc="Every movement of money, searchable and filterable." /><TxnBrowser /></>; }
