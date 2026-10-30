# MoneyFlow

**Personal money management for Android & iOS** — income, spending, budgets, accounts, savings goals, debts, bills, and reports in one calm place.

Built with **React Native (Expo) + TypeScript + Supabase**.

---

## What is implemented

| Area | Status |
|------|--------|
| Architecture, design system, light/dark theme | ✅ |
| Auth (register, login, logout, session restore) | ✅ (requires Supabase) |
| Profiles + RLS | ✅ |
| **Onboarding flow** (name, currency, first account, salary day) | ✅ |
| **Category seeding** on first setup | ✅ |
| Accounts (cash, bank, mobile money, savings…) | ✅ schema + UI |
| Transactions (income, expense, transfer) | ✅ core + decimal-safe math |
| Atomic transfers (paired records, not income/expense) | ✅ DB function |
| Soft-delete + balance adjustment | ✅ |
| Dashboard with **real week/month/quarter/year** period filters | ✅ |
| **Budget spent / remaining / %** (transfers excluded) | ✅ |
| Create monthly budget from UI | ✅ |
| Goals screens (structure + progress bars) | ✅ |
| Settings (hide balances, theme, currency display) | ✅ |
| Bottom tabs + modal add-transaction | ✅ |
| Money library with Decimal.js (no float math) | ✅ |
| Unit tests for money helpers | ✅ |
| Supabase migration + RLS policies | ✅ |
| CSV import, full charts, push notifications, AI insights, bank/M-Pesa feeds | 🔲 Next iteration |

---

## Quick start

### 1. Prerequisites

- Node 18+ (20+ recommended)
- Expo CLI / `npx expo`
- A free [Supabase](https://supabase.com) project

### 2. Install

```bash
cd moneyflow
npm install
```

### 3. Environment

```bash
cp .env.example .env
```

Fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_DEFAULT_CURRENCY=KES
```

### 4. Database

In the Supabase SQL editor (or with Supabase CLI):

```bash
# If using CLI
supabase db push
# or paste the contents of
# supabase/migrations/20241030000000_init.sql
```

This creates tables, indexes, RLS, the `handle_new_user` trigger, and the `create_transfer` function.

### 5. Run

```bash
npx expo start
```

Scan the QR code with Expo Go (Android/iOS) or press `a` / `i` for emulators.

---

## Architecture

```
src/
  components/ui/     # Card, Button, MoneyText
  constants/         # theme, default categories
  hooks/             # useTheme
  lib/               # supabase client, money (Decimal.js)
  navigation/        # Root stack + bottom tabs
  screens/           # auth, dashboard, transactions, budgets, goals, settings
  services/          # auth, transactions
  store/             # Zustand
  types/             # domain models
supabase/migrations/ # schema + RLS
tests/unit/          # money math tests
```

**Ledger is source of truth.** Account `current_balance` is a cache updated on write; transfers are paired and never counted as income or expense.

**Money** is always stored and calculated as decimal strings via `decimal.js`. Never use native JS numbers for totals.

---

## Security notes

- Row Level Security on every user-owned table.
- Secrets only in `.env` / EAS secrets — never committed.
- No storage of bank PINs, passwords, or OTPs.
- Optional biometric unlock via `expo-local-authentication` (wired, enable in settings).
- Soft-delete on transactions; audit table ready for significant edits.

---

## Kenya / M-Pesa ready design

The schema and services intentionally keep an **integration boundary**:

- Manual entry and CSV import work fully without any bank connection.
- A future M-Pesa or bank feed would live behind a server-side Edge Function with webhook verification, idempotency keys, and reconciliation against the ledger.
- Never scrape credentials or ask for PIN/OTP inside the app.

---

## Testing

```bash
npm run test:unit
```

Money arithmetic, transfer pairing, and budget inclusion rules should be covered before any production release.

---

## Deployment

1. Create an [EAS](https://expo.dev/eas) project and set `extra.eas.projectId` in `app.json`.
2. Store Supabase keys as EAS secrets.
3. `eas build --platform all`
4. Submit to Play Store / App Store following Expo docs.

---

## What requires external services

- **Auth + database + RLS** → Supabase (or compatible Postgres + Auth)
- **Push notifications** → Expo Notifications + device permissions
- **Charts (advanced)** → `react-native-chart-kit` is included; wire data from services
- **AI insights** → opt-in backend; keep feature-flagged (`EXPO_PUBLIC_AI_ENABLED`)
- **M-Pesa / bank feeds** → official provider credentials + Edge Functions (not bundled)

---

## License

Private / your choice. Provide a privacy policy before public release.
