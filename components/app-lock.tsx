'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from './app-provider';
import { Button, Input } from './ui';

const KEY = 'mm_lock_v1'; const IDLE_MS = 60_000; const MAX_TRIES = 5;
type Saved = { salt: string; hash: string };
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function digest(pin: string, salt: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`))); }
const read = (): Saved | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
export const hasPin = () => !!read();
export async function setPin(pin: string) { const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer); localStorage.setItem(KEY, JSON.stringify({ salt, hash: await digest(pin, salt) })); }
export const clearPin = () => localStorage.removeItem(KEY);

/** Screen lock for this device. It hides the app from someone holding an unlocked phone — it is not encryption. */
export function AppLock({ children }: { children: React.ReactNode }) {
  const { sb } = useApp();
  const [state, setState] = useState<'init' | 'locked' | 'open'>('init'); const [pin, setPinV] = useState(''); const [err, setErr] = useState(''); const [tries, setTries] = useState(0);
  const hiddenAt = useRef<number | null>(null);
  useEffect(() => { setState(hasPin() ? 'locked' : 'open'); }, []);
  useEffect(() => {
    const on = () => { if (document.hidden) hiddenAt.current = Date.now(); else if (hiddenAt.current && Date.now() - hiddenAt.current > IDLE_MS && hasPin()) { setState('locked'); setPinV(''); } };
    document.addEventListener('visibilitychange', on); return () => document.removeEventListener('visibilitychange', on);
  }, []);
  const submit = useCallback(async () => {
    const s = read(); if (!s) return setState('open');
    if (await digest(pin, s.salt) === s.hash) { setState('open'); setPinV(''); setErr(''); setTries(0); } else { setTries((t) => t + 1); setPinV(''); setErr('Wrong PIN'); }
  }, [pin]);
  async function signOut() { clearPin(); await sb.auth.signOut(); window.location.href = '/login'; }
  return (<>
    {children}
    {state !== 'open' && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6" role="dialog" aria-modal="true" aria-label="App locked">
        {state === 'locked' && <div className="w-full max-w-xs space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Lock className="h-5 w-5" /></div>
          <div><div className="font-semibold">Money Manager Pro is locked</div><p className="text-sm text-muted-foreground">Enter your PIN to continue</p></div>
          <Input type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={6} className="text-center text-xl tracking-[0.5em]" aria-label="PIN" value={pin}
            onChange={(e) => { setPinV(e.target.value.replace(/\D/g, '')); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && submit()} />
          {err && <p role="alert" className="text-sm text-destructive">{err}{tries >= MAX_TRIES ? ' — too many tries' : ''}</p>}
          <Button className="w-full" disabled={pin.length < 4} onClick={submit}>Unlock</Button>
          {tries >= 3 && <button onClick={signOut} className="text-xs underline text-muted-foreground">Forgot PIN? Sign out and log in again</button>}
        </div>}
      </div>)}
  </>);
}

export function AppLockSettings() {
  const [on, setOn] = useState(false); const [mode, setMode] = useState<'idle' | 'set'>('idle'); const [a, setA] = useState(''); const [b, setB] = useState(''); const [msg, setMsg] = useState('');
  useEffect(() => { setOn(hasPin()); }, []);
  async function save() { if (!/^\d{4,6}$/.test(a)) return setMsg('Use 4 to 6 digits'); if (a !== b) return setMsg('PINs do not match'); await setPin(a); setOn(true); setMode('idle'); setA(''); setB(''); setMsg('PIN lock is on for this device.'); }
  return (<div className="space-y-3">
    <p className="text-sm text-muted-foreground">Ask for a PIN when you open the app or come back after a minute away. It&apos;s stored only on this device, so set it on each phone you use. It keeps casual snoopers out; it is not a replacement for your phone&apos;s own screen lock.</p>
    {mode === 'set' ? (<div className="grid max-w-xs gap-2">
      <Input type="password" inputMode="numeric" maxLength={6} placeholder="New PIN (4–6 digits)" aria-label="New PIN" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} />
      <Input type="password" inputMode="numeric" maxLength={6} placeholder="Repeat PIN" aria-label="Repeat PIN" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} />
      <div className="flex gap-2"><Button onClick={save}>Save PIN</Button><Button variant="outline" onClick={() => { setMode('idle'); setMsg(''); }}>Cancel</Button></div></div>)
      : (<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setMode('set'); setMsg(''); }}>{on ? 'Change PIN' : 'Set a PIN'}</Button>{on && <Button variant="outline" onClick={() => { clearPin(); setOn(false); setMsg('PIN lock removed.'); }}>Turn off</Button>}</div>)}
    {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
  </div>);
}
