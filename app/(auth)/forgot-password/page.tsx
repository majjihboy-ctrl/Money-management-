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
const schema = z.object({ email: z.string().email('Enter a valid email') });
export default function Forgot() {
  const sb = useMemo(() => createClient(), []); const [sent, setSent] = useState(false);
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  async function submit(v: z.infer<typeof schema>) {
    const { error } = await sb.auth.resetPasswordForEmail(v.email, { redirectTo: `${location.origin}/auth/callback?next=/reset-password` });
    if (error) return void toast.error(error.message);
    setSent(true);
  }
  if (sent) return <AuthCard title="Check your email" desc="If an account exists for that address, a reset link is on its way."><Link href="/login" className="text-sm text-primary underline">Back to log in</Link></AuthCard>;
  return (
    <AuthCard title="Reset your password" desc="Enter your email and we'll send a reset link.">
      <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
        <Field label="Email" error={f.formState.errors.email?.message}><Input type="email" autoComplete="email" {...f.register('email')} /></Field>
        <Button type="submit" className="w-full" loading={f.formState.isSubmitting}>Send reset link</Button>
      </form>
      <Link href="/login" className="mt-4 inline-block text-sm text-primary underline">Back to log in</Link>
    </AuthCard>
  );
}
