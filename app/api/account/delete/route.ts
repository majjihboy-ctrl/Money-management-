import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import { rateLimit, sameOrigin } from '@/lib/rate-limit';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!rateLimit(`del:${user.id}`, 3, 3600_000)) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== 'DELETE') return NextResponse.json({ error: 'Confirmation text is incorrect' }, { status: 400 });
  const a = admin();
  for (const bucket of ['receipts', 'avatars']) {
    const paths: string[] = [];
    const { data: folders } = await a.storage.from(bucket).list(user.id, { limit: 1000 });
    for (const f of folders ?? []) {
      if (f.id) paths.push(`${user.id}/${f.name}`);
      else { const { data: files } = await a.storage.from(bucket).list(`${user.id}/${f.name}`, { limit: 1000 }); (files ?? []).forEach((x) => paths.push(`${user.id}/${f.name}/${x.name}`)); }
    }
    if (paths.length) await a.storage.from(bucket).remove(paths);
  }
  const { error } = await a.auth.admin.deleteUser(user.id); // cascades to every table
  if (error) return NextResponse.json({ error: 'Could not delete account' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
