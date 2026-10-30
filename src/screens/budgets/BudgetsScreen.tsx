import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MoneyText } from '../../components/ui/MoneyText';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { spacing, typography, radius } from '../../constants/theme';
import { listBudgets, createMonthlyBudget, getBudgetProgress, type BudgetProgress } from '../../services/budgets';
import { isSupabaseConfigured } from '../../lib/supabase';
import { money } from '../../lib/money';

function progressColor(percent: number, colors: ReturnType<typeof useTheme>['colors']) {
  if (percent >= 100) return colors.expense;
  if (percent >= 90) return colors.expense;
  if (percent >= 75) return colors.warning;
  if (percent >= 50) return colors.warning;
  return colors.income;
}

export function BudgetsScreen() {
  const { colors } = useTheme();
  const session = useAppStore((s) => s.session);
  const categories = useAppStore((s) => s.categories);
  const setBudgets = useAppStore((s) => s.setBudgets);
  const budgets = useAppStore((s) => s.budgets);

  const [progressList, setProgressList] = useState<BudgetProgress[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newLimit, setNewLimit] = useState('');
  const [creating, setCreating] = useState(false);

  const categoryMap = new Map(
    categories.map((c) => [c.id, { name: c.name, color: c.color }])
  );

  const load = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId || !isSupabaseConfigured) return;

    try {
      const list = await listBudgets(userId);
      setBudgets(list);

      const progresses: BudgetProgress[] = [];
      for (const b of list) {
        const p = await getBudgetProgress(userId, b, categoryMap);
        progresses.push(p);
      }
      setProgressList(progresses);
    } catch (e) {
      console.warn('Budget load error', e);
    }
  }, [session, categories]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  async function handleCreate() {
    const userId = session?.user?.id;
    if (!userId) return;
    setCreating(true);
    try {
      const limit = newLimit.trim() ? money(newLimit) : null;
      await createMonthlyBudget(userId, 'Monthly budget', limit);
      setShowCreate(false);
      setNewLimit('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create budget');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[typography.h1, { color: colors.text }]}>Budgets</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              Transfers between your accounts never count as spending
            </Text>
          </View>
          <Pressable
            onPress={() => setShowCreate(!showCreate)}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 20 }}>+</Text>
          </Pressable>
        </View>

        {showCreate && (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={[typography.h3, { color: colors.text }]}>New monthly budget</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              Overall spending limit for this month (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, marginTop: spacing.md },
              ]}
              value={newLimit}
              onChangeText={setNewLimit}
              keyboardType="decimal-pad"
              placeholder="e.g. 50000"
              placeholderTextColor={colors.textMuted}
            />
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm }}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowCreate(false)} style={{ flex: 1 }} />
              <Button title="Create" onPress={handleCreate} loading={creating} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {progressList.length === 0 && !showCreate ? (
          <Card style={{ marginTop: spacing.xl }}>
            <Text style={[typography.body, { color: colors.text }]}>No budgets yet</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Create a monthly budget to track spent vs remaining. Internal transfers are excluded automatically.
            </Text>
            <Button title="Create monthly budget" onPress={() => setShowCreate(true)} style={{ marginTop: spacing.lg }} />
          </Card>
        ) : (
          progressList.map((p) => {
            const barColor = progressColor(p.overallPercent, colors);
            return (
              <Card key={p.budgetId} style={{ marginTop: spacing.lg }}>
                <View style={styles.rowBetween}>
                  <Text style={[typography.h3, { color: colors.text }]}>{p.name}</Text>
                  {p.overallLimit && (
                    <Text style={[typography.captionBold, { color: barColor }]}>
                      {p.overallPercent.toFixed(0)}%
                    </Text>
                  )}
                </View>

                {p.overallLimit ? (
                  <>
                    <View style={[styles.barBg, { backgroundColor: colors.borderSubtle, marginTop: spacing.md }]}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min(100, p.overallPercent)}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                    <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
                      <View>
                        <Text style={[typography.tiny, { color: colors.textMuted }]}>SPENT</Text>
                        <MoneyText amount={p.overallSpent} size="sm" color={colors.expense} />
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={[typography.tiny, { color: colors.textMuted }]}>LIMIT</Text>
                        <MoneyText amount={p.overallLimit} size="sm" />
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[typography.tiny, { color: colors.textMuted }]}>REMAINING</Text>
                        <MoneyText
                          amount={p.overallRemaining}
                          size="sm"
                          color={parseFloat(p.overallRemaining) < 0 ? colors.expense : colors.income}
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                    Spent this period: <MoneyText amount={p.overallSpent} size="sm" />
                  </Text>
                )}

                {p.categories.length > 0 && (
                  <View style={{ marginTop: spacing.lg }}>
                    <Text style={[typography.captionBold, { color: colors.textSecondary }]}>By category</Text>
                    {p.categories.map((c) => {
                      const cColor = progressColor(c.percent, colors);
                      return (
                        <View key={c.categoryId} style={{ marginTop: spacing.md }}>
                          <View style={styles.rowBetween}>
                            <Text style={[typography.body, { color: colors.text }]}>{c.categoryName}</Text>
                            <Text style={[typography.caption, { color: cColor }]}>{c.percent.toFixed(0)}%</Text>
                          </View>
                          <View style={[styles.barBg, { backgroundColor: colors.borderSubtle, height: 4 }]}>
                            <View
                              style={[
                                styles.barFill,
                                { width: `${Math.min(100, c.percent)}%`, backgroundColor: cColor, height: 4 },
                              ]}
                            />
                          </View>
                          <Text style={[typography.tiny, { color: colors.textMuted, marginTop: 2 }]}>
                            {c.spent} / {c.limit}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
});
