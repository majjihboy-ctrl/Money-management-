'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AuthCard } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
const passwordRule = z.string().min(8, 'At least 8 characters').regex(/[a-z]/, 'Add a lowercase letter').regex(/[A-Z]/, 'Add an uppercase letter').regex(/\d/, 'Add a number');
const schema = z.object({ name: z.string().min(1, 'Enter your name').max(80), email: z.string().email('Enter a valid email'), password: passwordRule, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type V = z.infer<typeof schema>;
export default function Register() {
  const sb = useMemo(() => createClient(), []); const [sent, setSent] = useState(false);
  const f = useForm<V>({ resolver: zodResolver(schema) });
  async function submit(v: V) {
    const { error } = await sb.auth.signUp({ email: v.email, password: v.password, options: { data: { full_name: v.name }, emailRedirectTo: `${location.origin}/auth/callback` } });
    if (error) return void toast.error(error.message);
    setSent(true);
  }
  const { errors, isSubmitting } = f.formState;
  if (sent) return <AuthCard title="Check your email" desc="We sent you a verification link. Open it to activate your account, then log in."><Link href="/login" className="text-sm text-primary underline">Back to log in</Link></AuthCard>;
  return (
    <AuthCard title="Create your account" desc="Your data stays private to you.">
      <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.name?.message}><Input autoComplete="name" {...f.register('name')} /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...f.register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...f.register('password')} /></Field>
        <Field label="Confirm password" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...f.register('confirm')} /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
      <p className="mt-4 text-sm">Already registered? <Link href="/login" className="text-primary underline">Log in</Link></p>
    </AuthCard>
  );
}
