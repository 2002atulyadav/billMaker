import type { Translator } from '@/i18n';
import { formatQty, minorToDecimal } from '@/lib/money';
import type { Bill, BillLine } from '@/types';

export type CsvCell = string | number | null;

/**
 * Text that a spreadsheet would run as a formula ("=HYPERLINK(...)", "+91...", "-5") is prefixed
 * with an apostrophe so a customer name can never execute anything when the file is opened.
 */
function cell(v: CsvCell): string {
  if (v === null) return '';
  if (typeof v === 'number') return String(v);
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * RFC 4180 CSV with CRLF line endings and a UTF-8 byte-order mark, which Excel needs to show
 * Hindi and ₹ correctly instead of garbled characters.
 */
export function toCsv(rows: CsvCell[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

const money = (minor: number) => minorToDecimal(minor);

/** One row per bill: what an accountant needs to reconcile sales and dues. */
export function billsCsv(bills: Bill[], t: Translator['t']): string {
  return toCsv([
    [
      t('csv.billNo'), t('csv.date'), t('csv.customer'), t('csv.phone'), t('csv.subtotal'),
      t('csv.discount'), t('csv.total'), t('csv.status'), t('csv.paidOn'), t('csv.notes'),
    ],
    ...bills.map((b) => [
      b.bill_no,
      b.date,
      b.customer_name,
      b.customer_phone,
      money(b.subtotal_minor),
      money(b.discount_minor),
      money(b.total_minor),
      t(b.status === 'paid' ? 'pdf.statusPaid' : 'pdf.statusUnpaid'),
      // paid_at is SQLite's "YYYY-MM-DD HH:MM:SS" (UTC); the date part is enough here
      b.paid_at ? b.paid_at.slice(0, 10) : '',
      b.notes,
    ]),
  ]);
}

/** One row per bill line, for seeing what was sold (or which trips were billed) in a period. */
export function billLinesCsv(bills: (Bill & { lines: BillLine[] })[], t: Translator['t'], unit: Translator['unit']): string {
  const rows: CsvCell[][] = [
    [
      t('csv.billNo'), t('csv.date'), t('csv.customer'), t('csv.item'), t('csv.workDate'), t('csv.qty'),
      t('csv.unit'), t('csv.rate'), t('csv.amount'), t('csv.details'),
    ],
  ];
  for (const b of bills) {
    for (const l of b.lines) {
      rows.push([
        b.bill_no,
        b.date,
        b.customer_name,
        l.description,
        l.entry_date ?? '',
        formatQty(l.qty),
        unit(l.unit),
        money(l.unit_price_minor),
        money(l.line_total_minor),
        // In the bill's own column order (From, To, Vehicle no.)
        b.detail_fields
          .map((f) => l.details[f.key]?.trim())
          .filter(Boolean)
          .join(' · '),
      ]);
    }
  }
  return toCsv(rows);
}

/** "Bills-2026-04-01-to-2027-03-31.csv" */
export function csvFileName(kind: 'Bills' | 'Bill-items', start: string | null, end: string | null): string {
  return start && end ? `${kind}-${start}-to-${end}.csv` : `${kind}-all.csv`;
}
