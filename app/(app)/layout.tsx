import { AppProvider } from '@/components/app-provider';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider><Shell>{children}</Shell></AppProvider>;
}
