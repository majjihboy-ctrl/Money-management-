import type { Config } from 'tailwindcss';
const c = (n: string) => `hsl(var(--${n}) / <alpha-value>)`;
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: { card: '0 1px 2px hsl(var(--shadow) / 0.04), 0 4px 16px -6px hsl(var(--shadow) / 0.10)', fab: '0 8px 24px -6px hsl(var(--primary) / 0.55)' },
      colors: {
        background: c('background'), foreground: c('foreground'), card: c('card'), 'card-foreground': c('foreground'),
        muted: c('muted'), 'muted-foreground': c('muted-foreground'), border: c('border'), ring: c('ring'),
        primary: c('primary'), 'primary-foreground': c('primary-foreground'),
        destructive: c('destructive'), success: c('success'), warning: c('warning'),
      },
    },
  },
  plugins: [],
};
export default config;
