import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { Card } from '../../components/ui/Card';
import { MoneyText } from '../../components/ui/MoneyText';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { spacing, typography } from '../../constants/theme';

export function AccountsScreen() {
  const { colors } = useTheme();
  const accounts = useAppStore((s) => s.accounts.filter((a) => !a.is_archived));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListHeaderComponent={
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Cash, bank, mobile money and savings. Transfers between these do not create income or expense.
          </Text>
        }
        ListEmptyComponent={
          <Card>
            <Text style={[typography.body, { color: colors.text }]}>No accounts yet</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Add a cash wallet or bank account from onboarding or settings.
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={[typography.h3, { color: colors.text }]}>{item.name}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {item.type.replace('_', ' ')} · {item.currency}
                </Text>
              </View>
              <MoneyText amount={item.current_balance} size="lg" />
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
