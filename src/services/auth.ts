import { Platform, Alert } from 'react-native';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/** Cross-platform message (Alert is unreliable on some web browsers). */
export function notify(title: string, message?: string) {
  const text = message ? `${title}\n\n${message}` : title;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(text);
    return;
  }
  Alert.alert(title, message);
}

export async function signUp(email: string, password: string, displayName?: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Backend not configured. Supabase keys missing from this build.');
  }
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo:
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin + window.location.pathname
          : undefined,
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Backend not configured. Supabase keys missing from this build.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    // Friendlier messages
    const msg = error.message || '';
    if (/email not confirmed/i.test(msg) || /confirm/i.test(msg)) {
      throw new Error(
        'Email not confirmed yet. Check your inbox for the Supabase confirmation link, or disable "Confirm email" in Supabase → Authentication → Providers → Email.'
      );
    }
    if (/invalid login/i.test(msg) || /invalid credentials/i.test(msg)) {
      throw new Error('Wrong email or password.');
    }
    throw error;
  }
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  if (!isSupabaseConfigured) throw new Error('Backend not configured');
  const redirectTo =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin + window.location.pathname
      : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

// Biometrics only on native — never import native modules at top-level for web
export async function enableBiometric(_enabled: boolean) {
  if (Platform.OS === 'web') return;
  try {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync('moneyflow_biometric_enabled', _enabled ? '1' : '0');
  } catch {
    /* ignore on unsupported platforms */
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const SecureStore = await import('expo-secure-store');
    const v = await SecureStore.getItemAsync('moneyflow_biometric_enabled');
    return v === '1';
  } catch {
    return false;
  }
}

export async function authenticateWithBiometric(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock MoneyFlow',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
