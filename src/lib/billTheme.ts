import { addDays } from '@/lib/due';
import { todayISO } from '@/lib/money';
import { presetFor, presetItemName } from '@/lib/presets';
import type { BillWithLines, Lang, Profile } from '@/types';

/** Bill designs the owner can pick; the choice is saved on the profile and used for every bill they share. */
export const BILL_THEMES = ['classic', 'bold', 'bahi', 'receipt'] as const;
export type BillThemeId = (typeof BILL_THEMES)[number];

export const ACCENTS = {
  blue: '#1F6FEB',
  green: '#1A7F37',
  maroon: '#8B1E3F',
  saffron: '#C2570C',
  purple: '#6E40C9',
  black: '#111418',
} as const;
export type AccentId = keyof typeof ACCENTS;
export const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];

export type BillThemeTokens = {
  theme: BillThemeId;
  accent: string;
  /** a pale tint of the accent for table headers and boxes */
  accentSoft: string;
  /** line: rule under the header · band: coloured block · centred: bill-book · compact: receipt */
  headerStyle: 'line' | 'band' | 'centred' | 'compact';
  /** rows: dividers · tinted: tinted header · grid: boxed cells · plain: no lines */
  tableStyle: 'rows' | 'tinted' | 'grid' | 'plain';
  pageBorder: boolean;
  amountInWords: boolean;
  signature: boolean;
  /** black and white, compact (receipt) */
  mono: boolean;
};

export const isBillTheme = (x: unknown): x is BillThemeId => (BILL_THEMES as readonly unknown[]).includes(x);
export const isAccent = (x: unknown): x is AccentId => typeof x === 'string' && x in ACCENTS;

/** "#1F6FEB" mixed with white, e.g. 0.12 -> a pale tint for backgrounds. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * amount + 255 * (1 - amount));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Everything a renderer (PDF or in-app) needs to draw a bill in this theme. Unknown values fall back to Classic + blue. */
export function themeTokens(theme: string, accent: string): BillThemeTokens {
  const id: BillThemeId = isBillTheme(theme) ? theme : 'classic';
  const color = id === 'receipt' ? ACCENTS.black : ACCENTS[isAccent(accent) ? accent : 'blue'];
  const base = { theme: id, accent: color, accentSoft: tint(color, 0.1), pageBorder: false, amountInWords: false, signature: false, mono: false };
  switch (id) {
    case 'bold':
      return { ...base, headerStyle: 'band', tableStyle: 'tinted' };
    case 'bahi':
      return { ...base, headerStyle: 'centred', tableStyle: 'grid', pageBorder: true, amountInWords: true, signature: true };
    case 'receipt':
      return { ...base, accentSoft: '#FFFFFF', headerStyle: 'compact', tableStyle: 'plain', mono: true };
    default:
      return { ...base, headerStyle: 'line', tableStyle: 'rows' };
  }
}

export const profileTheme = (p: Pick<Profile, 'bill_theme' | 'bill_accent'>) => themeTokens(p.bill_theme, p.bill_accent);

const FALLBACK_ITEMS = [
  { en: 'Rice (5 kg bag)', hi: 'चावल (5 किलो)', unit: 'pcs', price: 45000, qty: 2 },
  { en: 'Sugar', hi: 'चीनी', unit: 'kg', price: 4500, qty: 3 },
  { en: 'Delivery', hi: 'डिलीवरी', unit: 'other', price: 5000, qty: 1 },
];

/**
 * A realistic bill for previews: the owner's own business details with their trade's starter items,
 * so the theme picker shows what their customers will actually receive.
 */
export function sampleBill(profile: Profile, lang: Lang, today = todayISO()): BillWithLines {
  const preset = presetFor(profile.trade).items.slice(0, 3);
  const lines = (preset.length
    ? preset.map((i, n) => ({ description: presetItemName(i, lang), unit: i.unit, price: i.price_minor, qty: n === 0 ? 2 : 1 }))
    : FALLBACK_ITEMS.map((i) => ({ description: lang === 'hi' ? i.hi : i.en, unit: i.unit, price: i.price, qty: i.qty }))
  ).map((l) => ({
    description: l.description,
    qty: l.qty,
    unit: l.unit,
    unit_price_minor: l.price,
    line_total_minor: Math.round(l.qty * l.price),
    entry_date: null,
    details: {},
  }));
  const total = lines.reduce((s, l) => s + l.line_total_minor, 0);
  return {
    id: 0,
    bill_no: `${profile.bill_prefix}0001`,
    customer_name: lang === 'hi' ? 'रमेश ट्रेडर्स' : 'Ramesh Traders',
    customer_phone: '98765 43210',
    customer_address: '',
    client_id: null,
    date: today,
    due_date: addDays(today, 7),
    discount_minor: 0,
    notes: '',
    subtotal_minor: total,
    total_minor: total,
    status: 'unpaid',
    paid_minor: 0,
    paid_at: null,
    last_reminded_at: null,
    period_start: null,
    period_end: null,
    detail_fields: [],
    created_at: '',
    lines,
    payments: [],
  };
}
