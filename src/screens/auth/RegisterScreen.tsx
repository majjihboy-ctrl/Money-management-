import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, radius } from '../../constants/theme';
import { signUp } from '../../services/auth';
import { isSupabaseConfigured } from '../../lib/supabase';

export function RegisterScreen() {
  const { colors } = useTheme();
  const nav = useNavigation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email.trim() || !password || password.length < 8) {
      Alert.alert('Check fields', 'Valid email and password (min 8 chars) required');
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert('Backend not configured', 'Add Supabase keys to .env');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim() || undefined);
      Alert.alert('Check your email', 'We sent a confirmation link. After confirming, sign in.');
      nav.navigate('Login' as never);
    } catch (e: any) {
      Alert.alert('Registration failed', e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.inner}>
          <Text style={[typography.h1, { color: colors.text }]}>Create account</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xl }]}>
            Start managing your money with clarity
          </Text>

          <Text style={[typography.captionBold, { color: colors.textSecondary }]}>Preferred name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={name}
            onChangeText={setName}
            placeholder="How should we call you?"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.md }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[typography.captionBold, { color: colors.textSecondary, marginTop: spacing.md }]}>Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textMuted}
          />

          <Button title="Create account" onPress={handleRegister} loading={loading} style={{ marginTop: spacing.xl }} />
          <Button title="Already have an account" variant="ghost" onPress={() => nav.navigate('Login' as never)} style={{ marginTop: spacing.sm }} />
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
