'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AuthCard } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
type V = z.infer<typeof schema>;
export default function Login() {
  const sb = useMemo(() => createClient(), []); const router = useRouter();
  const f = useForm<V>({ resolver: zodResolver(schema) });
  async function submit(v: V) {
    const { error } = await sb.auth.signInWithPassword(v);
    if (error) return void toast.error(error.message.includes('Email not confirmed') ? 'Please verify your email first. Check your inbox.' : 'Invalid email or password');
    router.replace('/dashboard'); router.refresh();
  }
  const { errors, isSubmitting } = f.formState;
  return (
    <AuthCard title="Welcome back" desc="Log in to your private financial workspace.">
      <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...f.register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...f.register('password')} /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Log in</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm"><Link href="/forgot-password" className="text-primary underline">Forgot password?</Link><Link href="/register" className="text-primary underline">Create account</Link></div>
    </AuthCard>
  );
}
