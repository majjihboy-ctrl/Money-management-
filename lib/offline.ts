import type { SupabaseClient } from '@supabase/supabase-js';
/** Tiny offline outbox for new income/expense entries. Each item carries a client-generated id, and save_transaction upserts by that id, so retries never double-count. */
const KEY = 'mm-outbox-v1';
export type Queued = { p: Record<string, unknown>; splits: { category_id: string; amount_minor: number }[] };
const read = (): Queued[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (q: Queued[]) => { try { localStorage.setItem(KEY, JSON.stringify(q)); window.dispatchEvent(new Event('mm-outbox')); } catch { /* storage full or blocked */ } };
export const pending = () => (typeof localStorage === 'undefined' ? 0 : read().length);
export function enqueue(item: Queued) { const q = read().filter((x) => x.p.id !== item.p.id); q.push(item); write(q); }
export const isNetworkError = (e: unknown) => (typeof navigator !== 'undefined' && !navigator.onLine) || (e instanceof TypeError) || /failed to fetch|network|load failed/i.test(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? ''));
/** Sends queued items. Returns how many were saved. Items the server rejects (not a network problem) are dropped so they cannot block the queue. */
export async function flush(sb: SupabaseClient): Promise<{ saved: number; dropped: number }> {
  const q = read(); let saved = 0, dropped = 0; const keep: Queued[] = [];
  for (const it of q) {
    try { const { error } = await sb.rpc('save_transaction', { p: it.p, p_splits: it.splits }); if (!error) saved++; else if (isNetworkError(error)) keep.push(it); else dropped++; }
    catch (e) { if (isNetworkError(e)) keep.push(it); else dropped++; }
  }
  write(keep); return { saved, dropped };
}
