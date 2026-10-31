import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';
export const metadata: Metadata = { title: { default: 'Money Manager Pro', template: '%s · Money Manager Pro' }, description: 'Personal money management: income, expenses, budgets, savings and debts.',
  icons: { icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }], apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Money', statusBarStyle: 'default' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b835b' };
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><Toaster richColors position="top-center" /><PwaRegister />{children}</body>
    </html>
  );
}
