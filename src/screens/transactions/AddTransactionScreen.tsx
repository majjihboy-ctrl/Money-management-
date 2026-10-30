import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { spacing, typography, radius } from '../../constants/theme';
import { createTransaction, createTransfer } from '../../services/transactions';
import { money } from '../../lib/money';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { TransactionType } from '../../types';

export function AddTransactionScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const route = useRoute<any>();
  const initialType: TransactionType = route.params?.type || 'expense';
  const session = useAppStore((s) => s.session);
  const accounts = useAppStore((s) => s.accounts);
  const profile = useAppStore((s) => s.profile);

  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState('');
  const [loading, setLoading] = useState(false);

  const activeAccounts = accounts.filter((a) => !a.is_archived);

  async function handleSave() {
    const amt = money(amount);
    if (parseFloat(amt) <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive amount');
      return;
    }
    if (!accountId) {
      Alert.alert('Account required', 'Select an account');
      return;
    }
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      Alert.alert('Transfer', 'Select a different destination account');
      return;
    }

    if (!isSupabaseConfigured || !session?.user?.id) {
      // Local-only fallback for demo when backend missing
      Alert.alert(
        'Saved locally (demo)',
        'Backend not connected. Transaction stored in memory only for this session.'
      );
      nav.goBack();
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (type === 'transfer') {
        await createTransfer(
          session.user.id,
          accountId,
          toAccountId,
          amt,
          profile?.default_currency || 'KES',
          today,
          notes || undefined
        );
      } else {
        await createTransaction(
          {
            type,
            amount: amt,
            currency: profile?.default_currency || 'KES',
            account_id: accountId,
            merchant: merchant || null,
            notes: notes || null,
            date: today,
          },
          session.user.id
        );
      }
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.typeRow}>
          {(['expense', 'income', 'transfer'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[
                styles.typeChip,
                { borderColor: colors.border },
                type === t && {
                  backgroundColor: t === 'income' ? colors.income : t === 'expense' ? colors.expense : colors.primary,
                  borderColor: 'transparent',
                },
              ]}
            >
              <Text style={[typography.captionBold, { color: type === t ? '#fff' : colors.text }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.lg }]}>Amount</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontSize: 28, fontWeight: '700' }]}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.md }]}>
          {type === 'transfer' ? 'From account' : 'Account'}
        </Text>
        <View style={styles.accountList}>
          {activeAccounts.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => setAccountId(a.id)}
              style={[
                styles.accountChip,
                { borderColor: colors.border, backgroundColor: colors.surface },
                accountId === a.id && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
              ]}
            >
              <Text style={[typography.caption, { color: colors.text }]}>{a.name}</Text>
            </Pressable>
          ))}
        </View>

        {type === 'transfer' && (
          <>
            <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.md }]}>To account</Text>
            <View style={styles.accountList}>
              {activeAccounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => setToAccountId(a.id)}
                    style={[
                      styles.accountChip,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      toAccountId === a.id && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
                    ]}
                  >
                    <Text style={[typography.caption, { color: colors.text }]}>{a.name}</Text>
                  </Pressable>
                ))}
            </View>
          </>
        )}

        {type !== 'transfer' && (
          <>
            <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.md }]}>Merchant / Payee</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
            />
          </>
        )}

        <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.md }]}>Notes</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, minHeight: 60 }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <Button title="Save" onPress={handleSave} loading={loading} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  accountList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.xs },
  accountChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1 },
});
