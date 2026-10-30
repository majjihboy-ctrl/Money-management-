import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Switch, Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { spacing, typography, radius } from '../../constants/theme';

export function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const hideBalances = useAppStore((s) => s.hideBalances);
  const setHideBalances = useAppStore((s) => s.setHideBalances);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const profile = useAppStore((s) => s.profile);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>Privacy</Text>
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Hide balances</Text>
          <Switch value={hideBalances} onValueChange={setHideBalances} trackColor={{ true: colors.primary }} />
        </View>

        <Text style={[typography.h3, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>Appearance</Text>
        {(['system', 'light', 'dark'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTheme(t)}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
              theme === t && { borderColor: colors.primary },
            ]}
          >
            <Text style={[typography.body, { color: colors.text }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}

        <Text style={[typography.h3, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>Preferences</Text>
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[typography.body, { color: colors.text }]}>Default currency</Text>
          <Text style={[typography.bodyBold, { color: colors.primary }]}>
            {profile?.default_currency || 'KES'}
          </Text>
        </View>
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[typography.body, { color: colors.text }]}>Timezone</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {profile?.timezone || 'Africa/Nairobi'}
          </Text>
        </View>

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl }]}>
          MoneyFlow never stores bank PINs or OTPs. Data is protected by row-level security. Export and account deletion are available from the privacy policy section (to be completed with your legal text).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
});
