import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/ui/Card';
import { MoneyText } from '../../components/ui/MoneyText';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { spacing, typography, radius } from '../../constants/theme';
import { add, subtract, sum } from '../../lib/money';
import { getPeriodRange } from '../../utils/dates';
import type { PeriodFilter, Transaction } from '../../types';

const PERIODS: { key: PeriodFilter; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

export function DashboardScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const profile = useAppStore((s) => s.profile);
  const accounts = useAppStore((s) => s.accounts);
  const transactions = useAppStore((s) => s.transactions);
  const goals = useAppStore((s) => s.goals);
  const bills = useAppStore((s) => s.bills);
  const hideBalances = useAppStore((s) => s.hideBalances);
  const setHideBalances = useAppStore((s) => s.setHideBalances);
  const period = useAppStore((s) => s.period);
  const setPeriod = useAppStore((s) => s.setPeriod);
  const [refreshing, setRefreshing] = useState(false);

  const { from, to, label: periodLabel } = useMemo(() => getPeriodRange(period), [period]);

  const periodTx = useMemo(
    () => transactions.filter((t) => inRange(t.date, from, to)),
    [transactions, from, to]
  );

  // Transfers never count as income or expense
  const income = sum(
    periodTx.filter((t) => t.type === 'income' || t.type === 'refund').map((t) => t.amount)
  );
  const expense = sum(
    periodTx.filter((t) => t.type === 'expense' || t.type === 'debt_payment').map((t) => t.amount)
  );
  const available = subtract(income, expense);
  const totalBalance = sum(accounts.filter((a) => !a.is_archived).map((a) => a.current_balance));
  const savingsTotal = sum(goals.filter((g) => g.status === 'active').map((g) => g.current_amount));
  const upcomingBills = bills.filter((b) => b.is_active).slice(0, 3);
  const recent = transactions.slice(0, 5);

  // Spending by category (expenses only, current period)
  const spendingByCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of periodTx) {
      if ((t.type === 'expense' || t.type === 'debt_payment') && t.category_id) {
        map.set(t.category_id, add(map.get(t.category_id) || '0', t.amount));
      }
    }
    return Array.from(map.entries())
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 5);
  }, [periodTx]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Hello{profile?.preferred_name ? `, ${profile.preferred_name}` : ''}
            </Text>
            <Text style={[typography.h2, { color: colors.text }]}>Dashboard</Text>
          </View>
          <Pressable
            onPress={() => setHideBalances(!hideBalances)}
            hitSlop={12}
            accessibilityLabel={hideBalances ? 'Show balances' : 'Hide balances'}
          >
            <Ionicons name={hideBalances ? 'eye-off' : 'eye'} size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={[styles.periodRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[styles.periodChip, period === p.key && { backgroundColor: colors.primary }]}
            >
              <Text style={[typography.captionBold, { color: period === p.key ? '#fff' : colors.textSecondary }]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[typography.tiny, { color: colors.textMuted, marginTop: 4 }]}>{periodLabel}</Text>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Total balance</Text>
          <MoneyText amount={totalBalance} size="hero" style={{ marginTop: spacing.xs }} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.tiny, { color: colors.income }]}>INCOME</Text>
              <MoneyText amount={income} size="sm" color={colors.income} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.tiny, { color: colors.expense }]}>EXPENSES</Text>
              <MoneyText amount={expense} size="sm" color={colors.expense} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.tiny, { color: colors.textSecondary }]}>AVAILABLE</Text>
              <MoneyText amount={available} size="sm" />
            </View>
          </View>
        </Card>

        <View style={[styles.quickRow, { marginTop: spacing.lg }]}>
          <QuickAction
            icon="add-circle"
            label="Income"
            color={colors.income}
            onPress={() => nav.navigate('AddTransaction' as never, { type: 'income' } as never)}
          />
          <QuickAction
            icon="remove-circle"
            label="Expense"
            color={colors.expense}
            onPress={() => nav.navigate('AddTransaction' as never, { type: 'expense' } as never)}
          />
          <QuickAction
            icon="swap-horizontal"
            label="Transfer"
            color={colors.primary}
            onPress={() => nav.navigate('AddTransaction' as never, { type: 'transfer' } as never)}
          />
          <QuickAction
            icon="wallet"
            label="Accounts"
            color={colors.warning}
            onPress={() => nav.navigate('Accounts' as never)}
          />
        </View>

        <Card style={{ marginTop: spacing.lg }}>
          <View style={styles.rowBetween}>
            <Text style={[typography.h3, { color: colors.text }]}>Savings goals</Text>
            <MoneyText amount={savingsTotal} size="sm" color={colors.income} />
          </View>
          {goals.filter((g) => g.status === 'active').length === 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              No active goals yet. Create one from the Goals tab.
            </Text>
          ) : (
            goals
              .filter((g) => g.status === 'active')
              .slice(0, 3)
              .map((g) => {
                const pct = Math.min(100, (parseFloat(g.current_amount) / parseFloat(g.target_amount)) * 100);
                return (
                  <View key={g.id} style={{ marginTop: spacing.md }}>
                    <View style={styles.rowBetween}>
                      <Text style={[typography.body, { color: colors.text }]}>{g.name}</Text>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>{pct.toFixed(0)}%</Text>
                    </View>
                    <View style={[styles.progressBg, { backgroundColor: colors.borderSubtle }]}>
                      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: colors.income }]} />
                    </View>
                  </View>
                );
              })
          )}
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[typography.h3, { color: colors.text }]}>Upcoming bills</Text>
          {upcomingBills.length === 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              No upcoming bills. Add them from More → Bills.
            </Text>
          ) : (
            upcomingBills.map((b) => (
              <View key={b.id} style={[styles.rowBetween, { marginTop: spacing.md }]}>
                <View>
                  <Text style={[typography.body, { color: colors.text }]}>{b.name}</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>Due {b.next_due_date}</Text>
                </View>
                <MoneyText amount={b.amount} size="sm" />
              </View>
            ))
          )}
        </Card>

        <Card style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}>
          <View style={styles.rowBetween}>
            <Text style={[typography.h3, { color: colors.text }]}>Recent</Text>
            <Pressable onPress={() => nav.navigate('Transactions' as never)}>
              <Text style={[typography.captionBold, { color: colors.primary }]}>See all</Text>
            </Pressable>
          </View>
          {recent.length === 0 ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              No transactions yet. Tap + Income or Expense to start.
            </Text>
          ) : (
            recent.map((t: Transaction) => (
              <View key={t.id} style={[styles.rowBetween, { marginTop: spacing.md }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.text }]} numberOfLines={1}>
                    {t.merchant || t.type}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{t.date}</Text>
                </View>
                <MoneyText
                  amount={t.amount}
                  size="sm"
                  color={t.type === 'income' || t.type === 'refund' ? colors.income : colors.expense}
                  showSign={t.type === 'income' || t.type === 'refund'}
                />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.quickItem}>
      <View style={[styles.quickIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[typography.tiny, { color: colors.textSecondary, marginTop: 4 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  periodRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    marginTop: spacing.md,
  },
  periodChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  row: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { alignItems: 'center', flex: 1 },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBg: { height: 6, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});
