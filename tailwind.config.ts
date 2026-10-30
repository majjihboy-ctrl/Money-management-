import type { Config } from 'tailwindcss';
const c = (n: string) => `hsl(var(--${n}) / <alpha-value>)`;
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
