// Per-instance sliding window limiter. For multi-region hardening, swap for Upstash/Redis.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
export function sameOrigin(req: Request): boolean {
  const o = req.headers.get('origin'); if (!o) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try { return new URL(o).host === host; } catch { return false; }
}
