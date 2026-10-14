import { lineTotal } from '@/lib/money';
import { inPeriod, type Period } from '@/lib/period';
import type { BillDraft, Client, DetailField, Details, Entry } from '@/types';

export function entryTotal(e: Pick<Entry, 'qty' | 'unit_price_minor'>): number {
  return lineTotal(e.qty, e.unit_price_minor);
}

export function sumEntries(entries: Pick<Entry, 'qty' | 'unit_price_minor'>[]): { count: number; total_minor: number } {
  return { count: entries.length, total_minor: entries.reduce((s, e) => s + entryTotal(e), 0) };
}

/** Unbilled entries within the period, oldest first, which is the order they appear on the bill. */
export function billableEntries(entries: Entry[], period: Period): Entry[] {
  return entries
    .filter((e) => e.bill_id === null && inPeriod(e.date, period))
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
}

/** Entries grouped by calendar month, newest month first, for the client screen. */
export function groupByMonth(entries: Entry[]): { key: string; entries: Entry[]; unbilled_minor: number }[] {
  const groups = new Map<string, Entry[]>();
  for (const e of [...entries].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))) {
    const key = e.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.entries()].map(([key, es]) => ({
    key,
    entries: es,
    unbilled_minor: sumEntries(es.filter((e) => e.bill_id === null)).total_minor,
  }));
}

/**
 * One-line summary of an entry's trade fields, e.g. "Pune → Mumbai · MH12 AB 1234".
 * From/To are joined with an arrow; everything else with " · ". Empty values are skipped.
 */
export function detailsText(fields: DetailField[], details: Details): string {
  const parts: string[] = [];
  const from = details.from?.trim();
  const to = details.to?.trim();
  const hasRoute = fields.some((f) => f.key === 'from') && fields.some((f) => f.key === 'to');
  if (hasRoute && (from || to)) parts.push(`${from || '?'} → ${to || '?'}`);
  for (const f of fields) {
    if (hasRoute && (f.key === 'from' || f.key === 'to')) continue;
    const v = details[f.key]?.trim();
    if (v) parts.push(v);
  }
  return parts.join(' · ');
}

/** Drops empty values and keys that aren't one of the trade's fields. */
export function cleanDetails(fields: DetailField[], details: Details): Details {
  const out: Details = {};
  for (const f of fields) {
    const v = details[f.key]?.trim();
    if (v) out[f.key] = v;
  }
  return out;
}

/** Builds the consolidated bill for a client's entries in a period. Each entry becomes one dated line. */
export function periodBillDraft(opts: {
  client: Client;
  entries: Entry[];
  period: Period;
  fields: DetailField[];
  date: string;
}): BillDraft {
  const { client, entries, period, fields, date } = opts;
  // Only keep columns that at least one line actually fills, so the PDF doesn't carry empty columns.
  const used = fields.filter((f) => entries.some((e) => e.details[f.key]?.trim()));
  return {
    customer_name: client.name,
    customer_phone: client.phone,
    customer_address: client.address,
    client_id: client.id,
    date,
    discount_minor: 0,
    notes: '',
    period_start: period.start,
    period_end: period.end,
    detail_fields: used,
    lines: entries.map((e) => ({
      description: e.description,
      qty: e.qty,
      unit: e.unit,
      unit_price_minor: e.unit_price_minor,
      entry_date: e.date,
      details: cleanDetails(used, e.details),
    })),
  };
}
