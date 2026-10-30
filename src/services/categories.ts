import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../constants/categories';
import type { Category } from '../types';

/** Seed system default categories for a user if they have none. Idempotent. */
export async function seedDefaultCategories(userId: string): Promise<Category[]> {
  if (!isSupabaseConfigured) return [];

  const { data: existing, error: checkErr } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (checkErr) throw checkErr;
  if (existing && existing.length > 0) {
    // Already seeded — return all user + system categories
    const { data } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`);
    return (data || []) as Category[];
  }

  const rows = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
      user_id: userId,
      name: c.name,
      type: 'expense' as const,
      icon: c.icon,
      color: c.color,
      is_system: true,
    })),
    ...DEFAULT_INCOME_CATEGORIES.map((c) => ({
      user_id: userId,
      name: c.name,
      type: 'income' as const,
      icon: c.icon,
      color: c.color,
      is_system: true,
    })),
  ];

  const { data, error } = await supabase.from('categories').insert(rows).select();
  if (error) throw error;
  return (data || []) as Category[];
}

export async function listCategories(userId: string): Promise<Category[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('name');
  if (error) throw error;
  return (data || []) as Category[];
}
