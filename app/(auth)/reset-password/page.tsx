'use client';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AuthCard } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
const rule = z.string().min(8, 'At least 8 characters').regex(/[a-z]/, 'Add a lowercase letter').regex(/[A-Z]/, 'Add an uppercase letter').regex(/\d/, 'Add a number');
const schema = z.object({ password: rule, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
export default function Reset() {
  const sb = useMemo(() => createClient(), []); const router = useRouter();
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  async function submit(v: z.infer<typeof schema>) {
    const { error } = await sb.auth.updateUser({ password: v.password });
    if (error) return void toast.error(error.message.includes('session') ? 'Reset link expired. Request a new one.' : error.message);
    toast.success('Password updated'); router.replace('/dashboard'); router.refresh();
  }
  const { errors, isSubmitting } = f.formState;
  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
        <Field label="New password" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...f.register('password')} /></Field>
        <Field label="Confirm password" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...f.register('confirm')} /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </AuthCard>
  );
}
