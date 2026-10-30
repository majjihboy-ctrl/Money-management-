import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TextInput,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MoneyText } from '../../components/ui/MoneyText';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { spacing, typography, radius } from '../../constants/theme';
import type { Transaction } from '../../types';

export function TransactionsScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const transactions = useAppStore((s) => s.transactions);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filter !== 'all' && t.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (t.merchant || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q) ||
          t.type.includes(q)
        );
      }
      return true;
    });
  }, [transactions, search, filter]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[typography.h1, { color: colors.text }]}>Transactions</Text>
        <Pressable
          onPress={() => nav.navigate('AddTransaction' as never)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      <TextInput
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        placeholder="Search merchant, notes..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.filters}>
        {(['all', 'income', 'expense', 'transfer'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.chip,
              { borderColor: colors.border },
              filter === f && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Text style={[typography.captionBold, { color: filter === f ? '#fff' : colors.textSecondary }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
            <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md }]}>
              No transactions match
            </Text>
          </View>
        }
        renderItem={({ item }) => <TransactionRow item={item} />}
      />
    </SafeAreaView>
  );
}

function TransactionRow({ item }: { item: Transaction }) {
  const { colors } = useTheme();
  const isIn = item.type === 'income' || item.type === 'refund';
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: (isIn ? colors.income : colors.expense) + '22' }]}>
        <Ionicons
          name={item.type === 'transfer' ? 'swap-horizontal' : isIn ? 'arrow-down' : 'arrow-up'}
          size={18}
          color={isIn ? colors.income : colors.expense}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyBold, { color: colors.text }]} numberOfLines={1}>
          {item.merchant || item.type}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.date}</Text>
      </View>
      <MoneyText
        amount={item.amount}
        size="sm"
        color={isIn ? colors.income : item.type === 'transfer' ? colors.textSecondary : colors.expense}
        showSign={isIn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  search: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  filters: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: spacing.sm, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
});
