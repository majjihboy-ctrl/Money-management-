import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { signOut } from '../../services/auth';
import { spacing, typography, radius } from '../../constants/theme';

const ITEMS = [
  { key: 'accounts', label: 'Accounts', icon: 'wallet-outline', route: 'Accounts' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline', route: 'Settings' },
  { key: 'debts', label: 'Debts & credit', icon: 'card-outline', route: null },
  { key: 'bills', label: 'Bills & subscriptions', icon: 'calendar-outline', route: null },
  { key: 'reports', label: 'Reports & export', icon: 'bar-chart-outline', route: null },
  { key: 'import', label: 'Import CSV', icon: 'cloud-upload-outline', route: null },
];

export function MoreScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const reset = useAppStore((s) => s.reset);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {}
          reset();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={[typography.h1, { color: colors.text }]}>More</Text>
        <View style={{ marginTop: spacing.lg }}>
          {ITEMS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                if (item.route) nav.navigate(item.route as never);
                else Alert.alert('Coming soon', `${item.label} is planned in the next iteration.`);
              }}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name={item.icon as any} size={22} color={colors.primary} />
              <Text style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={handleSignOut}
          style={[styles.row, { backgroundColor: colors.expenseMuted, borderColor: colors.expense, marginTop: spacing.xl }]}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.expense} />
          <Text style={[typography.bodyBold, { color: colors.expense, marginLeft: spacing.md }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
});
