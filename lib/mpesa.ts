import { fromZonedTime } from 'date-fns-tz';

export type TxKind = 'income' | 'expense' | 'deposit' | 'withdrawal';
export type MpesaRow = {
  ok: true; code: string; label: string; txKind: TxKind; amountMinor: number; feeMinor: number;
  counterparty: string | null; description: string; occurredAt: string; balanceMinor: number | null;
  category: string | null; fuliza?: { outstandingMinor: number; dueDate: string | null }; raw: string;
};
export type MpesaBad = { ok: false; raw: string; reason: string };
export type MpesaParsed = MpesaRow | MpesaBad;

/** "1,234.50" -> 123450 without floating point. */
export function toMinor(s: string): number {
  const [i, f = ''] = s.replace(/,/g, '').replace(/\.$/, '').split('.');
  return Number(i || 0) * 100 + Number(f.padEnd(2, '0').slice(0, 2) || 0);
}
const AMT = String.raw`Ksh\.?\s?([\d,]+(?:\.\d{1,2})?)`;
const CODE = /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10}\b(?=\s*confirmed)/gi;

/** Split pasted text into individual messages (each starts with its 10-character M-Pesa code). */
export function splitMessages(text: string): string[] {
  const t = text.replace(/\r/g, '\n');
  const idx: number[] = []; let m: RegExpExecArray | null; CODE.lastIndex = 0;
  while ((m = CODE.exec(t))) idx.push(m.index);
  if (!idx.length) return t.trim() ? [t.trim()] : [];
  return idx.map((s, i) => t.slice(s, idx[i + 1] ?? t.length).replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const cleanName = (s: string) => s.replace(/\s+(?:\+?254|0)\d{8,9}$/, '').replace(/\.$/, '').trim();
const cap = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function when(s: string, tz: string): string | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let [, d, mo, y, h, mi, ap] = m; let hh = Number(h);
  if (ap) { const pm = ap.toUpperCase() === 'PM'; if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
  const yyyy = y.length === 2 ? 2000 + Number(y) : Number(y);
  const iso = `${yyyy}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${mi}:00`;
  try { return fromZonedTime(iso, tz).toISOString(); } catch { return null; }
}

export function parseMpesa(raw: string, tz: string): MpesaParsed {
  const s = raw.replace(/\s+/g, ' ').trim();
  const code = s.match(/^([A-Z0-9]{10})\b/i)?.[1]?.toUpperCase();
  if (!code) return { ok: false, raw, reason: "Couldn't find an M-Pesa code" };
  const fee = s.match(new RegExp(String.raw`Transaction cost,?\s*${AMT}`, 'i'));
  const bal = s.match(new RegExp(String.raw`(?:New )?M-?PESA balance is\s*${AMT}`, 'i'));
  const feeMinor = fee ? toMinor(fee[1]) : 0; const balanceMinor = bal ? toMinor(bal[1]) : null;
  const base = { ok: true as const, code, feeMinor, balanceMinor, raw, occurredAt: when(s, tz) ?? '' };
  const done = (r: Omit<MpesaRow, keyof typeof base | 'raw'>): MpesaParsed =>
    base.occurredAt ? { ...base, ...r } : { ok: false, raw, reason: "Couldn't read the date and time" };
  let m: RegExpMatchArray | null;

  if ((m = s.match(new RegExp(String.raw`Fuliza M-?PESA amount is\s*${AMT}`, 'i')))) {
    const out = s.match(new RegExp(String.raw`outstanding (?:amount|balance)? ?is\s*${AMT}`, 'i'));
    const due = s.match(/due (?:on|by) (\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ?? null;
    if (!out) return { ok: false, raw, reason: "Fuliza message without an outstanding amount" };
    return { ...base, occurredAt: when(s, tz) ?? new Date().toISOString(), label: 'Fuliza update', txKind: 'expense', amountMinor: 0, counterparty: 'Fuliza M-PESA',
      description: 'Fuliza M-PESA balance update', category: null, fuliza: { outstandingMinor: toMinor(out[1]), dueDate: due } };
  }
  if ((m = s.match(new RegExp(String.raw`${AMT} from your M-?PESA has been used to (?:fully |partially )?pay your outstanding Fuliza`, 'i')))) {
    const out = s.match(new RegExp(String.raw`outstanding (?:amount|balance)? ?is\s*${AMT}`, 'i'));
    return done({ label: 'Fuliza repayment', txKind: 'expense', amountMinor: toMinor(m[1]), counterparty: 'Fuliza M-PESA', description: 'Fuliza repayment', category: 'Debt Repayment',
      ...(out ? { fuliza: { outstandingMinor: toMinor(out[1]), dueDate: null } } : {}) });
  }
  if ((m = s.match(new RegExp(String.raw`received\s*${AMT}\s*from (.+?)(?= on \d)`, 'i')))) {
    const who = cleanName(m[2]); return done({ label: 'Received', txKind: 'income', amountMinor: toMinor(m[1]), counterparty: cap(who), description: `Received from ${cap(who)}`, category: 'Other Income' });
  }
  if ((m = s.match(new RegExp(String.raw`${AMT} sent to (.+?) for account (\S+?)\.? (?:on|New)`, 'i')))) {
    const who = cleanName(m[2]); return done({ label: 'Paybill', txKind: 'expense', amountMinor: toMinor(m[1]), counterparty: cap(who), description: `Paybill ${cap(who)} · acc ${m[3]}`, category: 'Other Expenses' });
  }
  if ((m = s.match(new RegExp(String.raw`${AMT} sent to (.+?)(?= on \d)`, 'i')))) {
    const who = cleanName(m[2]); return done({ label: 'Sent', txKind: 'expense', amountMinor: toMinor(m[1]), counterparty: cap(who), description: `Sent to ${cap(who)}`, category: 'Other Expenses' });
  }
  if ((m = s.match(new RegExp(String.raw`${AMT} paid to (.+?)\.?(?= on \d)`, 'i')))) {
    const who = cleanName(m[2]); return done({ label: 'Till payment', txKind: 'expense', amountMinor: toMinor(m[1]), counterparty: cap(who), description: `Paid to ${cap(who)}`, category: 'Other Expenses' });
  }
  if ((m = s.match(new RegExp(String.raw`bought\s*${AMT} of airtime`, 'i')))) {
    return done({ label: 'Airtime', txKind: 'expense', amountMinor: toMinor(m[1]), counterparty: 'Airtime', description: 'Airtime purchase', category: 'Airtime' });
  }
  if ((m = s.match(new RegExp(String.raw`Withdraw\s*${AMT} from (.+?)(?= New M-?PESA| Transaction cost|$)`, 'i')))) {
    return done({ label: 'Withdrawal', txKind: 'withdrawal', amountMinor: toMinor(m[1]), counterparty: cap(m[2].trim()), description: `Cash withdrawal · ${cap(m[2].trim())}`, category: null });
  }
  if ((m = s.match(new RegExp(String.raw`Give\s*${AMT} cash to (.+?)(?= New M-?PESA| Transaction cost|$)`, 'i')))) {
    return done({ label: 'Cash deposit', txKind: 'deposit', amountMinor: toMinor(m[1]), counterparty: cap(m[2].trim()), description: `Cash deposit · ${cap(m[2].trim())}`, category: null });
  }
  return { ok: false, raw, reason: 'Message type not recognised yet' };
}
export const parseAll = (text: string, tz: string) => splitMessages(text).map((x) => parseMpesa(x, tz));
/** Net effect on the M-Pesa balance of a parsed row (fee included). */
export const netEffect = (r: MpesaRow) => (r.txKind === 'income' || r.txKind === 'deposit' ? r.amountMinor : -r.amountMinor) - r.feeMinor;
