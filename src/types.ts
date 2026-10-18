export const UNITS = ['pcs', 'kg', 'km', 'hr', 'trip', 'day', 'month', 'visit', 'ltr', 'mtr', 'ton', 'other'] as const;
export type Unit = (typeof UNITS)[number];

export type Profile = {
  business_name: string;
  owner_name: string;
  phone: string;
  address: string;
  /** data: URI so it can be embedded straight into the PDF */
  logo_uri: string | null;
  currency: string;
  bill_prefix: string;
  /** e.g. "ravi@okhdfc"; empty when not set. Used for the "Scan to pay" QR. */
  upi_id: string;
  /** chosen at onboarding; see src/lib/presets.ts */
  trade: Trade;
  /** app UI language */
  language: Lang;
  /** language of bill/statement labels; 'both' prints "Total / कुल" */
  bill_language: BillLang;
  next_bill_no: number;
  /** datetime('now') of the last backup made or restored; null if never */
  last_backup_at: string | null;
  /** 1 = ask for fingerprint / Face ID / passcode when the app opens */
  app_lock: number;
  /** bill design: 'classic' | 'bold' | 'bahi' | 'receipt' (see src/lib/billTheme.ts) */
  bill_theme: string;
  /** accent colour key from ACCENTS, e.g. 'blue' */
  bill_accent: string;
};

/** What the profile form edits. Trade, languages, bill numbering and the backup date have their own setters. */
export type ProfileInput = Omit<Profile, 'next_bill_no' | 'trade' | 'language' | 'bill_language' | 'last_backup_at' | 'app_lock' | 'bill_theme' | 'bill_accent'
>;

export const LANGS = ['en', 'hi'] as const;
export type Lang = (typeof LANGS)[number];
export type BillLang = Lang | 'both';

export const TRADES = ['transport', 'taxi', 'tutor', 'repair', 'tailor', 'freelancer', 'shop', 'general'] as const;
export type Trade = (typeof TRADES)[number];

export type Item = {
  id: number;
  name: string;
  price_minor: number;
  unit: Unit;
};

/** A trade-specific extra field on a work entry, e.g. { key: 'from', label: 'From' } for transport. */
export type DetailField = { key: string; label: string; placeholder?: string };

/** Values for DetailFields, keyed by DetailField.key. */
export type Details = Record<string, string>;

export type BillLine = {
  description: string;
  qty: number;
  unit: string;
  unit_price_minor: number;
  line_total_minor: number;
  /** set on lines that came from a work entry */
  entry_date: string | null;
  details: Details;
};

export type Bill = {
  id: number;
  bill_no: string;
  customer_name: string;
  customer_phone: string;
  /** YYYY-MM-DD */
  date: string;
  discount_minor: number;
  notes: string;
  subtotal_minor: number;
  total_minor: number;
  status: BillStatus;
  /** sum of recorded payments (cache kept in step with the payments table) */
  paid_minor: number;
  /** datetime('now') when it became fully paid, else null */
  paid_at: string | null;
  /** YYYY-MM-DD the customer should pay by; null = no due date */
  due_date: string | null;
  /** datetime('now') of the last WhatsApp reminder */
  last_reminded_at: string | null;
  /** set when the bill was made for a saved client */
  client_id: number | null;
  customer_address: string;
  /** set on period bills built from work entries (YYYY-MM-DD, inclusive) */
  period_start: string | null;
  period_end: string | null;
  /** snapshot of the trade's detail columns when the bill was made, so later trade changes don't alter it */
  detail_fields: DetailField[];
  created_at: string;
};

export type BillStatus = 'unpaid' | 'partial' | 'paid';

export const PAYMENT_METHODS = ['upi', 'cash', 'bank', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Money received against a bill. A bill can be paid in parts. */
export type Payment = {
  id: number;
  bill_id: number;
  amount_minor: number;
  /** YYYY-MM-DD */
  date: string;
  method: PaymentMethod;
  /** UTR / cheque no. / any proof the owner wants to keep */
  reference: string;
  note: string;
};

export type BillWithLines = Bill & { lines: BillLine[]; payments: Payment[] };

export type BillDraft = {
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  client_id?: number | null;
  date: string;
  discount_minor: number;
  notes: string;
  due_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  detail_fields?: DetailField[];
  lines: {
    description: string;
    qty: number;
    unit: string;
    unit_price_minor: number;
    entry_date?: string | null;
    details?: Details;
  }[];
};

export type Client = {
  id: number;
  name: string;
  phone: string;
  address: string;
};

/** A piece of work logged against a client, billed later as part of a period bill. */
export type Entry = {
  id: number;
  client_id: number;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  qty: number;
  unit: string;
  unit_price_minor: number;
  details: Details;
  /** null while unbilled */
  bill_id: number | null;
  /** bill number it was billed on, joined for display */
  bill_no: string | null;
};
