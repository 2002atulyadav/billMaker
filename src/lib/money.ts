/**
 * All money is held as integer minor units (paise/cents) so totals never pick up
 * floating-point drift. Quantities may be fractional (2.5 kg, 12.4 km).
 */

const AMOUNT_RE = /^\d+(\.\d{0,2})?$/;
const QTY_RE = /^\d+(\.\d{0,3})?$/;

/** "12.5" -> 1250. Returns null for empty or invalid input. */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!AMOUNT_RE.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** "2.5" -> 2.5. Returns null for empty, invalid, or zero input. */
export function parseQty(text: string): number | null {
  const t = text.trim();
  if (!QTY_RE.test(t)) return null;
  const q = Number(t);
  return q > 0 ? q : null;
}

/** 1250 -> "12.50" (for pre-filling inputs). */
export function minorToInput(minor: number): string {
  return (minor / 100).toFixed(2).replace(/\.00$/, '');
}

/** 125000 -> "₹1,250.00" using Indian digit grouping. */
export function formatMoney(minor: number, currency: string): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100).toString();
  const frac = (abs % 100).toString().padStart(2, '0');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `${negative ? '-' : ''}${currency}${grouped}.${frac}`;
}

export function lineTotal(qty: number, unitPriceMinor: number): number {
  return Math.round(qty * unitPriceMinor);
}

export type Totals = { subtotal: number; discount: number; total: number };

/** Discount is clamped so the total never goes negative. */
export function computeTotals(
  lines: { qty: number; unit_price_minor: number }[],
  discountMinor: number,
): Totals {
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l.qty, l.unit_price_minor), 0);
  const discount = Math.min(Math.max(discountMinor, 0), subtotal);
  return { subtotal, discount, total: subtotal - discount };
}

/** Local date as YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "2026-10-11" -> "11 Oct 2026". Falls back to the raw string. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

export function isValidISODate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

export function formatBillNo(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, '0')}`;
}
