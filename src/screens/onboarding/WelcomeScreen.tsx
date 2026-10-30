import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';

export function WelcomeScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[typography.hero, { color: colors.text }]}>MoneyFlow</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }]}>
          All your money in one calm place. Track income, spending, budgets, goals and debts with clarity.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title="Create account" onPress={() => nav.navigate('Register')} style={{ marginBottom: spacing.md }} />
        <Button title="Sign in" variant="secondary" onPress={() => nav.navigate('Login')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', padding: spacing.xl },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  actions: { paddingBottom: spacing.xl },
});
