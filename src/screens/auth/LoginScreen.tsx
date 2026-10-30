import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, radius } from '../../constants/theme';
import { signIn, notify } from '../../services/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

export function LoginScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const setSession = useAppStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      notify('Missing fields', 'Enter email and password');
      return;
    }
    if (!isSupabaseConfigured) {
      notify(
        'Backend not configured',
        'Supabase keys are missing from this build. Redeploy with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
      );
      return;
    }
    setLoading(true);
    try {
      const data = await signIn(email.trim(), password);
      if (data.session) {
        setSession(data.session);
      } else {
        notify(
          'Almost there',
          'Signed in but no session returned. If email confirmation is required, confirm your email first.'
        );
      }
    } catch (e: any) {
      notify('Sign in failed', e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.inner}>
          <Text style={[typography.h1, { color: colors.text }]}>Welcome back</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xl }]}>
            Sign in to your MoneyFlow account
          </Text>

          <Text style={[typography.captionBold, { color: colors.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.md }]}>Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={handleLogin}
          />

          <Button title="Sign in" onPress={handleLogin} loading={loading} style={{ marginTop: spacing.xl }} />
          <Button
            title="Create account"
            variant="ghost"
            onPress={() => nav.navigate('Register' as never)}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginTop: spacing.xs,
    fontSize: 16,
  },
});
