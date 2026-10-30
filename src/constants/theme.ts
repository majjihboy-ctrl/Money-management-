/**
 * MoneyFlow Design System
 * Premium, modern, minimalist financial UI — light & dark
 */

export const colors = {
  light: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    border: '#e2e8f0',
    borderSubtle: '#f1f5f9',
    text: '#0f172a',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    primary: '#0ea5e9',
    primaryMuted: '#e0f2fe',
    income: '#10b981',
    incomeMuted: '#d1fae5',
    expense: '#ef4444',
    expenseMuted: '#fee2e2',
    warning: '#f59e0b',
    warningMuted: '#fef3c7',
    success: '#22c55e',
    error: '#dc2626',
    overlay: 'rgba(15, 23, 42, 0.4)',
    chart: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'],
  },
  dark: {
    background: '#0f172a',
    surface: '#1e293b',
    surfaceElevated: '#334155',
    border: '#334155',
    borderSubtle: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    primary: '#38bdf8',
    primaryMuted: '#0c4a6e',
    income: '#34d399',
    incomeMuted: '#064e3b',
    expense: '#f87171',
    expenseMuted: '#7f1d1d',
    warning: '#fbbf24',
    warningMuted: '#78350f',
    success: '#4ade80',
    error: '#f87171',
    overlay: 'rgba(0, 0, 0, 0.6)',
    chart: ['#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#a3e635', '#fb923c'],
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  hero: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '600' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  captionBold: { fontSize: 13, fontWeight: '600' as const },
  tiny: { fontSize: 11, fontWeight: '500' as const },
  money: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  moneySm: { fontSize: 18, fontWeight: '600' as const },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export type ThemeColors = typeof colors.light;
