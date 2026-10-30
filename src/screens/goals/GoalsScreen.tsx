import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Card } from '../../components/ui/Card';
import { MoneyText } from '../../components/ui/MoneyText';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { spacing, typography } from '../../constants/theme';

export function GoalsScreen() {
  const { colors } = useTheme();
  const goals = useAppStore((s) => s.goals);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={[typography.h1, { color: colors.text }]}>Goals</Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
          Emergency fund, travel, education and more
        </Text>
        {goals.length === 0 ? (
          <Card style={{ marginTop: spacing.xl }}>
            <Text style={[typography.body, { color: colors.text }]}>No goals yet</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Set a target amount and date. Contributions that are internal transfers do not create extra expenses.
            </Text>
          </Card>
        ) : (
          goals.map((g) => {
            const pct = Math.min(100, (parseFloat(g.current_amount) / parseFloat(g.target_amount)) * 100);
            return (
              <Card key={g.id} style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[typography.h3, { color: colors.text }]}>{g.name}</Text>
                  <Text style={[typography.captionBold, { color: colors.income }]}>{pct.toFixed(0)}%</Text>
                </View>
                <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: spacing.md }}>
                  <MoneyText amount={g.current_amount} size="sm" />
                  <Text style={[typography.caption, { color: colors.textMuted }]}>of</Text>
                  <MoneyText amount={g.target_amount} size="sm" color={colors.textSecondary} />
                </View>
                <View style={[styles.barBg, { backgroundColor: colors.borderSubtle }]}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: colors.income }]} />
                </View>
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
  barBg: { height: 8, borderRadius: 4, marginTop: spacing.md, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
});
