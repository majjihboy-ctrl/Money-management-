import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Money Manager Pro', short_name: 'Money', description: 'Track M-Pesa, bank and cash: income, expenses, budgets, savings and debts.',
    start_url: '/dashboard', scope: '/', display: 'standalone', orientation: 'portrait', background_color: '#f8fafc', theme_color: '#0b835b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
