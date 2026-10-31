'use client';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Archive, Pencil, Plus, Download, Trash2 } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { NotifPrefs } from '@/components/notif-prefs';
import { AppLockSettings } from '@/components/app-lock';
import { Button, Card, CardBody, CardHeader, Confirm, Field, Input, Modal, PageHeader, Select, Toggle, Badge } from '@/components/ui';
import { CURRENCIES } from '@/lib/money';
import { errMsg } from '@/lib/utils';
import type { Category } from '@/lib/types';

const pw = z.string().min(8, 'At least 8 characters').regex(/[a-z]/, 'Add a lowercase letter').regex(/[A-Z]/, 'Add an uppercase letter').regex(/\d/, 'Add a number');

function Preferences() {
  const { sb, profile, accounts, refresh } = useApp();
  const zones = useMemo(() => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone'); } catch { return ['Africa/Nairobi', 'UTC']; } }, []);
  const [v, setV] = useState({ currency: profile.currency, timezone: profile.timezone, theme: profile.theme, acc: profile.default_account_id ?? '', period: profile.default_budget_period, th: profile.warning_thresholds.join(', ') });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!/^\s*\d{1,3}(\s*,\s*\d{1,3}){0,2}\s*$/.test(v.th)) return void toast.error('Thresholds: up to three percentages, e.g. 75, 90, 100');
    setBusy(true);
    const { error } = await sb.from('profiles').update({ currency: v.currency, timezone: v.timezone, theme: v.theme, default_account_id: v.acc || null, default_budget_period: v.period, warning_thresholds: v.th.split(',').map((x) => Number(x.trim())).sort((a, b) => a - b) }).eq('id', profile.id);
    setBusy(false); if (error) return void toast.error(errMsg(error)); toast.success('Preferences saved'); refresh();
  }
  return (
    <Card><CardHeader title="Preferences" /><CardBody className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency" hint={v.currency !== profile.currency ? 'Existing amounts are NOT converted. Only the display currency changes.' : undefined}><Select value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Timezone"><Select value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })}>{zones.map((z) => <option key={z}>{z}</option>)}</Select></Field>
        <Field label="Theme"><Select value={v.theme} onChange={(e) => setV({ ...v, theme: e.target.value as 'light' })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select></Field>
        <Field label="Default account"><Select value={v.acc} onChange={(e) => setV({ ...v, acc: e.target.value })}><option value="">None</option>{accounts.filter((a) => !a.archived_at).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Default budget period"><Select value={v.period} onChange={(e) => setV({ ...v, period: e.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom</option></Select></Field>
        <Field label="Budget warning thresholds (%)"><Input value={v.th} onChange={(e) => setV({ ...v, th: e.target.value })} /></Field>
      </div>
      <Button onClick={save} loading={busy}>Save preferences</Button>
    </CardBody></Card>
  );
}

function Profile() {
  const { sb, user, profile, refresh } = useApp(); const [name, setName] = useState(profile.full_name ?? ''); const [busy, setBusy] = useState(false); const [avatar, setAvatar] = useState('');
  useMemo(() => { if (profile.avatar_path) sb.storage.from('avatars').createSignedUrl(profile.avatar_path, 3600).then(({ data }) => setAvatar(data?.signedUrl ?? '')); }, [profile.avatar_path, sb]);
  async function save() { setBusy(true); const { error } = await sb.from('profiles').update({ full_name: name.trim() || null }).eq('id', profile.id); setBusy(false); if (error) return void toast.error(errMsg(error)); toast.success('Profile saved'); refresh(); }
  async function upload(file?: File) {
    if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return void toast.error('Use a JPG, PNG or WebP image'); if (file.size > 2 * 1024 * 1024) return void toast.error('Image must be 2 MB or smaller');
    const path = `${user.id}/avatar-${Date.now()}`; const up = await sb.storage.from('avatars').upload(path, file, { contentType: file.type }); if (up.error) return void toast.error(up.error.message);
    if (profile.avatar_path) await sb.storage.from('avatars').remove([profile.avatar_path]);
    await sb.from('profiles').update({ avatar_path: path }).eq('id', profile.id); toast.success('Photo updated'); refresh();
  }
  return (
    <Card><CardHeader title="Profile" /><CardBody className="space-y-4">
      <div className="flex items-center gap-4">{/* eslint-disable-next-line @next/next/no-img-element */}{avatar ? <img src={avatar} alt="Profile" className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-semibold">{(name || user.email || '?')[0].toUpperCase()}</div>}
        <Input type="file" accept="image/jpeg,image/png,image/webp" className="h-auto max-w-xs py-2" onChange={(e) => upload(e.target.files?.[0])} aria-label="Profile photo" /></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field><Field label="Email"><Input value={user.email ?? ''} disabled /></Field></div>
      <Button onClick={save} loading={busy}>Save profile</Button>
    </CardBody></Card>
  );
}

function Password() {
  const { sb } = useApp();
  const f = useForm<{ password: string; confirm: string }>({ resolver: zodResolver(z.object({ password: pw, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })) });
  async function submit(v: { password: string }) { const { error } = await sb.auth.updateUser({ password: v.password }); if (error) return void toast.error(errMsg(error)); toast.success('Password changed'); f.reset(); }
  const { errors, isSubmitting } = f.formState;
  return (
    <Card><CardHeader title="Change password" /><CardBody><form onSubmit={f.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="New password" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...f.register('password')} /></Field>
      <Field label="Confirm" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...f.register('confirm')} /></Field>
      <div><Button type="submit" loading={isSubmitting}>Update password</Button></div></form></CardBody></Card>
  );
}

function Categories() {
  const { sb, categories, refresh } = useApp(); const [kind, setKind] = useState<'expense' | 'income'>('expense'); const [edit, setEdit] = useState<Category | 'new' | null>(null); const [name, setName] = useState(''); const [del, setDel] = useState<Category | null>(null);
  async function save() {
    const n = name.trim(); if (!n || n.length > 60) return void toast.error('Enter a name up to 60 characters');
    const { error } = edit && edit !== 'new' ? await sb.from('categories').update({ name: n }).eq('id', edit.id) : await sb.from('categories').insert({ name: n, kind });
    if (error) return void toast.error(error.code === '23505' ? 'That category already exists' : errMsg(error)); setEdit(null); setName(''); refresh();
  }
  async function remove() {
    if (!del) return; const { error } = await sb.from('categories').delete().eq('id', del.id);
    if (error) { if (error.code === '23503') { await sb.from('categories').update({ archived_at: new Date().toISOString() }).eq('id', del.id); toast.success('Category is in use, so it was archived instead. History is preserved.'); } else return void toast.error(errMsg(error)); } else toast.success('Category deleted');
    setDel(null); refresh();
  }
  return (
    <Card><CardHeader title="Categories" action={<Button size="sm" onClick={() => { setName(''); setEdit('new'); }}><Plus className="h-4 w-4" />Add</Button>} /><CardBody>
      <div className="mb-3 inline-flex rounded-lg bg-muted p-1">{(['expense', 'income'] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={`rounded-md px-3 py-1 text-sm capitalize ${kind === k ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{k}</button>)}</div>
      <ul className="divide-y divide-border">{categories.filter((c) => c.kind === kind && !c.archived_at).map((c) => <li key={c.id} className="flex items-center justify-between py-2 text-sm"><span>{c.name} {c.is_default && <Badge>Default</Badge>}</span><span><Button size="icon" variant="ghost" aria-label={`Rename ${c.name}`} onClick={() => { setName(c.name); setEdit(c); }}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => setDel(c)}><Trash2 className="h-4 w-4" /></Button></span></li>)}</ul>
    </CardBody>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? `New ${kind} category` : 'Rename category'}><div className="space-y-4"><Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} /></Field><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></div></div></Modal>
      <Confirm open={!!del} title="Delete category?" desc="If transactions use it, it is archived instead so your history stays intact." onConfirm={remove} onCancel={() => setDel(null)} />
    </Card>
  );
}

function DataPrivacy() {
  const { sb, profile, refresh } = useApp(); const [open, setOpen] = useState(false); const [txt, setTxt] = useState(''); const [busy, setBusy] = useState(false);
  async function hide(v: boolean) { const { error } = await sb.from('profiles').update({ privacy: { ...profile.privacy, hide_balances: v } }).eq('id', profile.id); if (error) return void toast.error(errMsg(error)); refresh(); }
  async function del() {
    setBusy(true);
    try { const r = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: txt }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? 'Deletion failed');
      await sb.auth.signOut(); window.location.href = '/login'; } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  }
  return (
    <Card><CardHeader title="Privacy & data" /><CardBody className="space-y-4">
      <Toggle label="Hide balances on screen (blur amounts on dashboard and accounts)" checked={!!profile.privacy?.hide_balances} onChange={hide} />
      <div className="flex flex-wrap gap-2"><a href="/api/export" download><Button variant="outline"><Download className="h-4 w-4" />Export my data (JSON)</Button></a></div>
      <div className="rounded-lg border border-destructive/40 p-4"><div className="font-medium text-destructive">Delete account</div><p className="mt-1 text-sm text-muted-foreground">Permanently deletes your login and all financial data, receipts and photos. This cannot be undone. Export your data first.</p><Button variant="destructive" className="mt-3" onClick={() => setOpen(true)}><Archive className="h-4 w-4" />Delete my account</Button></div>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete account permanently?"><div className="space-y-4"><p className="text-sm text-muted-foreground">Type <b>DELETE</b> to confirm.</p><Input value={txt} onChange={(e) => setTxt(e.target.value)} aria-label="Type DELETE" /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={txt !== 'DELETE'} loading={busy} onClick={del}>Delete everything</Button></div></div></Modal>
    </CardBody></Card>
  );
}

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-4"><Profile /><Preferences /><Card><CardHeader title="Notification preferences" /><CardBody><NotifPrefs /></CardBody></Card><Categories /><Card><CardHeader title="App lock (PIN)" /><CardBody><AppLockSettings /></CardBody></Card><Password /><DataPrivacy /></div>
    </>
  );
}
