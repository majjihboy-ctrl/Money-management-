import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
export const metadata: Metadata = { title: { default: 'Money Manager Pro', template: '%s · Money Manager Pro' }, description: 'Personal money management: income, expenses, budgets, savings and debts.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><Toaster richColors position="top-center" />{children}</body>
    </html>
  );
}
