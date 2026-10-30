import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { spacing, typography, radius } from '../../constants/theme';
import { completeOnboarding } from '../../services/onboarding';
import { notify } from '../../services/auth';
import { seedDefaultCategories } from '../../services/categories';
import { listAccounts } from '../../services/accounts';
import { listCategories } from '../../services/categories';
import type { AccountType } from '../../types';

const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS', 'NGN'];
const ACCOUNT_TYPES: { type: AccountType; label: string }[] = [
  { type: 'cash', label: 'Cash' },
  { type: 'mobile_money', label: 'M-Pesa / Mobile money' },
  { type: 'bank', label: 'Bank account' },
  { type: 'savings', label: 'Savings' },
];

export function OnboardingScreen() {
  const { colors } = useTheme();
  const session = useAppStore((s) => s.session);
  const setProfile = useAppStore((s) => s.setProfile);
  const setAccounts = useAppStore((s) => s.setAccounts);
  const setCategories = useAppStore((s) => s.setCategories);

  const [step, setStep] = useState(0);
  const [preferredName, setPreferredName] = useState('');
  const [currency, setCurrency] = useState('KES');
  const [accountName, setAccountName] = useState('Cash');
  const [accountType, setAccountType] = useState<AccountType>('cash');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [salaryDay, setSalaryDay] = useState('');
  const [loading, setLoading] = useState(false);

  const totalSteps = 3;

  async function finish() {
    const userId = session?.user?.id;
    if (!userId) {
      notify('Not signed in', 'Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const day = salaryDay ? parseInt(salaryDay, 10) : null;
      const { profile } = await completeOnboarding(userId, {
        preferredName: preferredName.trim() || 'Friend',
        defaultCurrency: currency,
        accountName: accountName.trim() || 'Cash',
        accountType,
        openingBalance: openingBalance || '0',
        salaryDay: day && day >= 1 && day <= 31 ? day : null,
        timezone: 'Africa/Nairobi',
      });

      setProfile({ ...profile, onboarding_completed: true });

      const [accounts, categories] = await Promise.all([
        listAccounts(userId),
        listCategories(userId),
      ]);
      setAccounts(accounts);
      setCategories(categories);
      notify('Setup complete', 'Your account is ready.');
    } catch (e: any) {
      const msg =
        e?.message ||
        e?.error_description ||
        (typeof e === 'string' ? e : null) ||
        'Please try again. If this keeps happening, confirm APPLY_ALL.sql ran in Supabase.';
      console.error('Onboarding failed', e);
      notify('Could not finish setup', msg);
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (step === 0 && !preferredName.trim()) {
      notify('Name needed', 'What should we call you?');
      return;
    }
    if (step === 1 && !accountName.trim()) {
      notify('Account name', 'Give your first account a name.');
      return;
    }
    if (step < totalSteps - 1) setStep(step + 1);
    else finish();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Progress */}
          <View style={styles.progressRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: i <= step ? colors.primary : colors.border,
                    flex: 1,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Step {step + 1} of {totalSteps}
          </Text>

          {step === 0 && (
            <View style={styles.step}>
              <Text style={[typography.h1, { color: colors.text }]}>Welcome</Text>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                Let’s set up MoneyFlow for you. This takes under a minute.
              </Text>

              <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.xl }]}>
                What should we call you?
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={preferredName}
                onChangeText={setPreferredName}
                placeholder="Your preferred name"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />

              <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.lg }]}>
                Default currency
              </Text>
              <View style={styles.chipRow}>
                {CURRENCIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCurrency(c)}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      currency === c && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
                    ]}
                  >
                    <Text style={[typography.captionBold, { color: currency === c ? colors.primary : colors.text }]}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 1 && (
            <View style={styles.step}>
              <Text style={[typography.h1, { color: colors.text }]}>First account</Text>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                Add the account you use most. You can add more later.
              </Text>

              <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.xl }]}>
                Account type
              </Text>
              <View style={styles.chipRow}>
                {ACCOUNT_TYPES.map((a) => (
                  <Pressable
                    key={a.type}
                    onPress={() => {
                      setAccountType(a.type);
                      if (!accountName || accountName === 'Cash' || ACCOUNT_TYPES.some((t) => t.label === accountName)) {
                        setAccountName(a.label);
                      }
                    }}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      accountType === a.type && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
                    ]}
                  >
                    <Text
                      style={[
                        typography.captionBold,
                        { color: accountType === a.type ? colors.primary : colors.text },
                      ]}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.lg }]}>
                Account name
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="e.g. M-Pesa, Equity Bank, Cash"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.lg }]}>
                Opening balance ({currency})
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={openingBalance}
                onChangeText={setOpeningBalance}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                Enter what is currently in this account. You can change it later.
              </Text>
            </View>
          )}

          {step === 2 && (
            <View style={styles.step}>
              <Text style={[typography.h1, { color: colors.text }]}>Almost done</Text>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                Optional: when do you usually get paid? This helps with budget timing.
              </Text>

              <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.xl }]}>
                Salary / payment day (1–31)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={salaryDay}
                onChangeText={setSalaryDay}
                keyboardType="number-pad"
                placeholder="e.g. 25 (leave blank if irregular)"
                placeholderTextColor={colors.textMuted}
                maxLength={2}
              />

              <View
                style={[
                  styles.summary,
                  { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.xl },
                ]}
              >
                <Text style={[typography.captionBold, { color: colors.textSecondary }]}>Summary</Text>
                <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm }]}>
                  Name: {preferredName || '—'}
                </Text>
                <Text style={[typography.body, { color: colors.text }]}>Currency: {currency}</Text>
                <Text style={[typography.body, { color: colors.text }]}>
                  Account: {accountName} ({accountType.replace('_', ' ')})
                </Text>
                <Text style={[typography.body, { color: colors.text }]}>
                  Opening: {currency} {openingBalance || '0.00'}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {step > 0 && (
            <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1, marginRight: spacing.sm }} />
          )}
          <Button
            title={step === totalSteps - 1 ? 'Finish setup' : 'Continue'}
            onPress={next}
            loading={loading}
            style={{ flex: 2 }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  progressDot: { height: 4, borderRadius: 2 },
  step: { marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginTop: spacing.xs,
    fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  summary: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
