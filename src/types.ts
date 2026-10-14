export const UNITS = ['pcs', 'kg', 'km', 'hr', 'trip', 'day', 'month', 'visit', 'ltr', 'mtr', 'other'] as const;
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
  next_bill_no: number;
};

/** What the profile form edits. Trade is fixed at onboarding and bill numbering has its own setter. */
export type ProfileInput = Omit<Profile, 'next_bill_no' | 'trade'>;

export const TRADES = ['taxi', 'tutor', 'repair', 'tailor', 'freelancer', 'shop', 'general'] as const;
export type Trade = (typeof TRADES)[number];

export type Item = {
  id: number;
  name: string;
  price_minor: number;
  unit: Unit;
};

export type BillLine = {
  description: string;
  qty: number;
  unit: string;
  unit_price_minor: number;
  line_total_minor: number;
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
  /** datetime('now') when marked paid, else null */
  paid_at: string | null;
  created_at: string;
};

export type BillStatus = 'unpaid' | 'paid';

export type BillWithLines = Bill & { lines: BillLine[] };

export type BillDraft = {
  customer_name: string;
  customer_phone: string;
  date: string;
  discount_minor: number;
  notes: string;
  lines: { description: string; qty: number; unit: string; unit_price_minor: number }[];
};
