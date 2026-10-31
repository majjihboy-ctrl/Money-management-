import { AppProvider } from '@/components/app-provider';
import { AppLock } from '@/components/app-lock';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider><AppLock><Shell>{children}</Shell></AppLock></AppProvider>;
}
