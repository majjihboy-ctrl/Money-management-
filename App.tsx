import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppStore } from './src/store/useAppStore';
import { onAuthStateChange, getSession } from './src/services/auth';
import { supabase, isSupabaseConfigured } from './src/lib/supabase';
import { seedDefaultCategories } from './src/services/categories';
import { useTheme } from './src/hooks/useTheme';

export default function App() {
  const setSession = useAppStore((s) => s.setSession);
  const setProfile = useAppStore((s) => s.setProfile);
  const setLoading = useAppStore((s) => s.setLoading);
  const setAccounts = useAppStore((s) => s.setAccounts);
  const setTransactions = useAppStore((s) => s.setTransactions);
  const setCategories = useAppStore((s) => s.setCategories);
  const setGoals = useAppStore((s) => s.setGoals);
  const setBills = useAppStore((s) => s.setBills);
  const setBudgets = useAppStore((s) => s.setBudgets);
  const isLoading = useAppStore((s) => s.isLoading);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const session = await getSession();
        if (!mounted) return;
        setSession(session);
        if (session?.user && isSupabaseConfigured) {
          await loadUserData(session.user.id);
        }
      } catch (e) {
        console.warn('Init error', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: sub } = onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user && isSupabaseConfigured) {
        await loadUserData(session.user.id);
      } else if (!session) {
        setProfile(null);
        setAccounts([]);
        setTransactions([]);
        setCategories([]);
        setGoals([]);
        setBills([]);
        setBudgets([]);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  async function loadUserData(userId: string) {
    try {
      const [profileRes, accountsRes, txRes, catRes, goalsRes, billsRes, budgetsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('accounts').select('*').eq('user_id', userId).eq('is_archived', false),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .limit(100),
        supabase.from('categories').select('*').or(`user_id.eq.${userId},user_id.is.null`),
        supabase.from('goals').select('*').eq('user_id', userId),
        supabase.from('bills').select('*').eq('user_id', userId).eq('is_active', true),
        supabase.from('budgets').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);

        // If onboarding done but categories missing, seed them
        if (profileRes.data.onboarding_completed) {
          const userCats = (catRes.data || []).filter((c: any) => c.user_id === userId);
          if (userCats.length === 0) {
            const seeded = await seedDefaultCategories(userId);
            setCategories(seeded);
          } else {
            setCategories(catRes.data || []);
          }
        } else if (catRes.data) {
          setCategories(catRes.data);
        }
      } else {
        // Profile row missing (rare) — treat as needs onboarding
        setProfile(null);
      }

      if (accountsRes.data) setAccounts(accountsRes.data);
      if (txRes.data) setTransactions(txRes.data);
      if (goalsRes.data) setGoals(goalsRes.data);
      if (billsRes.data) setBills(billsRes.data);
      if (budgetsRes.data) setBudgets(budgetsRes.data);
    } catch (e) {
      console.warn('Load data error', e);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <RootNavigator />
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
