import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import { rateLimit, sameOrigin } from '@/lib/rate-limit';

/** Explains the most common setup mistakes without ever revealing the key itself. */
function serviceKeyProblem(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return 'Server setup problem: SUPABASE_SERVICE_ROLE_KEY is missing in Vercel (Settings → Environment Variables).';
  if (key.startsWith('sb_publishable_')) return 'Server setup problem: SUPABASE_SERVICE_ROLE_KEY in Vercel holds the publishable key. Use the secret / service_role key.';
  const part = key.split('.')[1];
  if (part) { try { const role = JSON.parse(Buffer.from(part, 'base64url').toString()).role; if (role && role !== 'service_role') return `Server setup problem: SUPABASE_SERVICE_ROLE_KEY in Vercel is a "${role}" key. Use the service_role key.`; } catch { /* not a JWT: new-style secret keys are fine */ } }
  return null;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!rateLimit(`del:${user.id}`, 3, 3600_000)) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  // Tolerant of phone keyboards that add a trailing space or change the case.
  if (String(body?.confirm ?? '').trim().toUpperCase() !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 });
  const problem = serviceKeyProblem();
  if (problem) { console.error('delete-account: ' + problem); return NextResponse.json({ error: problem }, { status: 500 }); }
  const a = admin();
  for (const bucket of ['receipts', 'avatars']) {
    const paths: string[] = [];
    const { data: folders } = await a.storage.from(bucket).list(user.id, { limit: 1000 });
    for (const f of folders ?? []) {
      if (f.id) paths.push(`${user.id}/${f.name}`);
      else { const { data: files } = await a.storage.from(bucket).list(`${user.id}/${f.name}`, { limit: 1000 }); (files ?? []).forEach((x) => paths.push(`${user.id}/${f.name}/${x.name}`)); }
    }
    if (paths.length) { const { error: rmErr } = await a.storage.from(bucket).remove(paths); if (rmErr) console.error(`delete-account: could not remove ${bucket} files:`, rmErr.message); }
  }
  const { error } = await a.auth.admin.deleteUser(user.id); // cascades to every table
  if (error) {
    console.error('delete-account: deleteUser failed:', error.status, error.message);
    return NextResponse.json({ error: `Could not delete account: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
