import type { SQLiteDatabase } from 'expo-sqlite';

import { computeTotals, formatBillNo, lineTotal, minNextBillNo } from '@/lib/money';
import { periodBillDraft } from '@/lib/entries';
import { AppError } from '@/lib/errors';
import type { Period } from '@/lib/period';
import { presetFor, presetItemName } from '@/lib/presets';
import type {
  Bill,
  BillDraft,
  BillLang,
  BillLine,
  BillStatus,
  BillWithLines,
  Client,
  DetailField,
  Details,
  Entry,
  Item,
  Lang,
  Profile,
  ProfileInput,
  Trade,
  Unit,
} from '@/types';

/** JSON columns are written by this app, but never let a bad value crash a screen. */
function parseJson<T>(text: string | null | undefined, fallback: T): T {
  try {
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ---- profile ----

export function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  return db.getFirstAsync<Profile>(
    `SELECT business_name, owner_name, phone, address, logo_uri, currency, bill_prefix, upi_id, trade,
            language, bill_language, next_bill_no
     FROM profile WHERE id = 1`,
  );
}

/** Upsert; never touches next_bill_no so the bill numbering survives profile edits. */
export async function saveProfile(db: SQLiteDatabase, p: ProfileInput): Promise<void> {
  await db.runAsync(
    `INSERT INTO profile (id, business_name, owner_name, phone, address, logo_uri, currency, bill_prefix, upi_id)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       business_name = excluded.business_name, owner_name = excluded.owner_name,
       phone = excluded.phone, address = excluded.address, logo_uri = excluded.logo_uri,
       currency = excluded.currency, bill_prefix = excluded.bill_prefix, upi_id = excluded.upi_id`,
    p.business_name, p.owner_name, p.phone, p.address, p.logo_uri, p.currency, p.bill_prefix, p.upi_id,
  );
}

/**
 * First-run setup: creates the profile and seeds the trade's starter items (named in the chosen
 * language) in one transaction. Bills start in the same language as the app.
 */
export async function completeOnboarding(db: SQLiteDatabase, p: ProfileInput, trade: Trade, lang: Lang): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await saveProfile(txn, p);
    await txn.runAsync('UPDATE profile SET trade = ?, language = ?, bill_language = ? WHERE id = 1', trade, lang, lang);
    for (const item of presetFor(trade).items) {
      await txn.runAsync(
        'INSERT INTO items (name, price_minor, unit) VALUES (?, ?, ?)',
        presetItemName(item, lang), item.price_minor, item.unit,
      );
    }
  });
}

export async function setLanguage(db: SQLiteDatabase, language: Lang): Promise<void> {
  await db.runAsync('UPDATE profile SET language = ? WHERE id = 1', language);
}

export async function setBillLanguage(db: SQLiteDatabase, billLanguage: BillLang): Promise<void> {
  await db.runAsync('UPDATE profile SET bill_language = ? WHERE id = 1', billLanguage);
}

/**
 * Changes the business type. Only affects units and entry fields offered from now on; existing data is untouched.
 * With addItems, the trade's starter items are added, skipping names that already exist.
 */
export async function setTrade(db: SQLiteDatabase, trade: Trade, addItems = false, lang: Lang = 'en'): Promise<number> {
  let added = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('UPDATE profile SET trade = ? WHERE id = 1', trade);
    if (!addItems) return;
    for (const item of presetFor(trade).items) {
      const name = presetItemName(item, lang);
      const res = await txn.runAsync(
        `INSERT INTO items (name, price_minor, unit)
         SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM items WHERE lower(name) = lower(?))`,
        name, item.price_minor, item.unit, name,
      );
      added += res.changes;
    }
  });
  return added;
}

/** Lowest value setNextBillNo will accept for the current prefix. */
export async function getMinNextBillNo(db: SQLiteDatabase): Promise<number> {
  const p = await db.getFirstAsync<{ bill_prefix: string }>('SELECT bill_prefix FROM profile WHERE id = 1');
  const rows = await db.getAllAsync<{ bill_no: string }>('SELECT bill_no FROM bills');
  return minNextBillNo(p?.bill_prefix ?? '', rows.map((r) => r.bill_no));
}

/** Lets someone moving from a paper bill book continue their numbering. Refuses numbers that would repeat an existing bill. */
export async function setNextBillNo(db: SQLiteDatabase, n: number): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const min = await getMinNextBillNo(txn);
    if (!Number.isInteger(n) || n < min) {
      throw new AppError('numbering.tooLow', { min });
    }
    await txn.runAsync('UPDATE profile SET next_bill_no = ? WHERE id = 1', n);
  });
}

// ---- saved items ----

export function listItems(db: SQLiteDatabase): Promise<Item[]> {
  return db.getAllAsync<Item>('SELECT id, name, price_minor, unit FROM items ORDER BY name COLLATE NOCASE');
}

export async function saveItem(
  db: SQLiteDatabase,
  item: { id?: number; name: string; price_minor: number; unit: Unit },
): Promise<void> {
  if (item.id) {
    await db.runAsync(
      'UPDATE items SET name = ?, price_minor = ?, unit = ? WHERE id = ?',
      item.name, item.price_minor, item.unit, item.id,
    );
  } else {
    await db.runAsync(
      'INSERT INTO items (name, price_minor, unit) VALUES (?, ?, ?)',
      item.name, item.price_minor, item.unit,
    );
  }
}

export async function deleteItem(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM items WHERE id = ?', id);
}

// ---- bills ----

export type BillFilter = 'all' | BillStatus;

/** Escapes LIKE wildcards so searching for "50%" or "A_1" matches literally. */
export function likePattern(search: string): string {
  return `%${search.trim().replace(/[\\%_]/g, (ch) => '\\' + ch)}%`;
}

type BillRow = Omit<Bill, 'detail_fields'> & { detail_fields: string };

function toBill(row: BillRow): Bill {
  return { ...row, detail_fields: parseJson<DetailField[]>(row.detail_fields, []) };
}

export async function listBills(db: SQLiteDatabase, search: string, filter: BillFilter = 'all'): Promise<Bill[]> {
  const q = likePattern(search);
  const rows = await db.getAllAsync<BillRow>(
    `SELECT * FROM bills
     WHERE (bill_no LIKE ?1 ESCAPE '\\' OR customer_name LIKE ?1 ESCAPE '\\' OR customer_phone LIKE ?1 ESCAPE '\\')
       AND (?2 = 'all' OR status = ?2)
     ORDER BY id DESC`,
    q, filter,
  );
  return rows.map(toBill);
}

/** Total still owed across all unpaid bills. */
export async function getUnpaidSummary(db: SQLiteDatabase): Promise<{ count: number; total_minor: number }> {
  const row = await db.getFirstAsync<{ count: number; total_minor: number | null }>(
    `SELECT COUNT(*) AS count, SUM(total_minor) AS total_minor FROM bills WHERE status = 'unpaid'`,
  );
  return { count: row?.count ?? 0, total_minor: row?.total_minor ?? 0 };
}

export async function setBillStatus(db: SQLiteDatabase, id: number, status: BillStatus): Promise<void> {
  await db.runAsync(
    `UPDATE bills SET status = ?, paid_at = CASE WHEN ? = 'paid' THEN datetime('now') ELSE NULL END WHERE id = ?`,
    status, status, id,
  );
}

export type RecentCustomer = { customer_name: string; customer_phone: string; last_bill_id: number };

/** Distinct customers from past bills, most recent first. Bills are the customer list; there's no separate table. */
export function listRecentCustomers(db: SQLiteDatabase, limit = 50): Promise<RecentCustomer[]> {
  // SQLite returns the other columns from the row that produced MAX(id), i.e. the latest spelling of the name.
  return db.getAllAsync<RecentCustomer>(
    `SELECT customer_name, customer_phone, MAX(id) AS last_bill_id FROM bills
     WHERE customer_name <> '' OR customer_phone <> ''
     GROUP BY lower(customer_name), customer_phone
     ORDER BY last_bill_id DESC
     LIMIT ?`,
    limit,
  );
}

export async function getBill(db: SQLiteDatabase, id: number): Promise<BillWithLines | null> {
  const row = await db.getFirstAsync<BillRow>('SELECT * FROM bills WHERE id = ?', id);
  if (!row) return null;
  const lines = await db.getAllAsync<Omit<BillLine, 'details'> & { details: string }>(
    `SELECT description, qty, unit, unit_price_minor, line_total_minor, entry_date, details
     FROM bill_items WHERE bill_id = ? ORDER BY position`,
    id,
  );
  return { ...toBill(row), lines: lines.map((l) => ({ ...l, details: parseJson<Details>(l.details, {}) })) };
}

/**
 * Allocates the next bill number and writes the bill and its lines. Must run inside an exclusive
 * transaction so two saves can't take the same number. Totals are recomputed rather than trusted from the UI.
 */
async function insertBill(txn: SQLiteDatabase, draft: BillDraft): Promise<number> {
  const totals = computeTotals(draft.lines, draft.discount_minor);
  const p = await txn.getFirstAsync<{ bill_prefix: string; next_bill_no: number }>(
    'SELECT bill_prefix, next_bill_no FROM profile WHERE id = 1',
  );
  if (!p) throw new Error('Business profile is not set up');
  const billNo = formatBillNo(p.bill_prefix, p.next_bill_no);
  const res = await txn.runAsync(
    `INSERT INTO bills (bill_no, customer_name, customer_phone, customer_address, client_id, date, discount_minor, notes,
                        subtotal_minor, total_minor, period_start, period_end, detail_fields)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    billNo, draft.customer_name, draft.customer_phone, draft.customer_address ?? '', draft.client_id ?? null,
    draft.date, totals.discount, draft.notes, totals.subtotal, totals.total,
    draft.period_start ?? null, draft.period_end ?? null, JSON.stringify(draft.detail_fields ?? []),
  );
  const billId = res.lastInsertRowId;
  for (const [i, l] of draft.lines.entries()) {
    await txn.runAsync(
      `INSERT INTO bill_items (bill_id, position, description, qty, unit, unit_price_minor, line_total_minor, entry_date, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      billId, i, l.description, l.qty, l.unit, l.unit_price_minor, lineTotal(l.qty, l.unit_price_minor),
      l.entry_date ?? null, JSON.stringify(l.details ?? {}),
    );
  }
  await txn.runAsync('UPDATE profile SET next_bill_no = next_bill_no + 1 WHERE id = 1');
  return billId;
}

export async function createBill(db: SQLiteDatabase, draft: BillDraft): Promise<number> {
  let billId = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    billId = await insertBill(txn, draft);
  });
  return billId;
}

/** Deleting a period bill puts its entries back to unbilled (entries.bill_id is ON DELETE SET NULL). */
export async function deleteBill(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM bills WHERE id = ?', id);
}

// ---- clients ----

export type ClientSummary = Client & { unbilled_count: number; unbilled_minor: number };

export function listClients(db: SQLiteDatabase): Promise<ClientSummary[]> {
  // ROUND matches lineTotal() (Math.round) for the non-negative amounts we store.
  return db.getAllAsync<ClientSummary>(
    `SELECT c.id, c.name, c.phone, c.address,
            COUNT(e.id) AS unbilled_count,
            COALESCE(SUM(CAST(ROUND(e.qty * e.unit_price_minor) AS INTEGER)), 0) AS unbilled_minor
     FROM clients c LEFT JOIN entries e ON e.client_id = c.id AND e.bill_id IS NULL
     GROUP BY c.id
     ORDER BY c.name COLLATE NOCASE`,
  );
}

export function getClient(db: SQLiteDatabase, id: number): Promise<Client | null> {
  return db.getFirstAsync<Client>('SELECT id, name, phone, address FROM clients WHERE id = ?', id);
}

export async function saveClient(db: SQLiteDatabase, c: Omit<Client, 'id'> & { id?: number }): Promise<number> {
  if (c.id) {
    await db.runAsync('UPDATE clients SET name = ?, phone = ?, address = ? WHERE id = ?', c.name, c.phone, c.address, c.id);
    return c.id;
  }
  const res = await db.runAsync('INSERT INTO clients (name, phone, address) VALUES (?, ?, ?)', c.name, c.phone, c.address);
  return res.lastInsertRowId;
}

/** Removes the client and their entries. Bills already made keep their own copy of the client details. */
export async function deleteClient(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM clients WHERE id = ?', id);
}

// ---- work entries ----

type EntryRow = Omit<Entry, 'details'> & { details: string };

export async function listEntries(db: SQLiteDatabase, clientId: number): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT e.id, e.client_id, e.date, e.description, e.qty, e.unit, e.unit_price_minor, e.details, e.bill_id, b.bill_no
     FROM entries e LEFT JOIN bills b ON b.id = e.bill_id
     WHERE e.client_id = ?
     ORDER BY e.date DESC, e.id DESC`,
    clientId,
  );
  return rows.map((r) => ({ ...r, details: parseJson<Details>(r.details, {}) }));
}

export type EntryInput = Pick<Entry, 'client_id' | 'date' | 'description' | 'qty' | 'unit' | 'unit_price_minor' | 'details'> & {
  id?: number;
};

/** Billed entries are locked: they're part of a bill that may already have been sent. */
export async function saveEntry(db: SQLiteDatabase, e: EntryInput): Promise<void> {
  const details = JSON.stringify(e.details);
  if (e.id) {
    const res = await db.runAsync(
      `UPDATE entries SET date = ?, description = ?, qty = ?, unit = ?, unit_price_minor = ?, details = ?
       WHERE id = ? AND bill_id IS NULL`,
      e.date, e.description, e.qty, e.unit, e.unit_price_minor, details, e.id,
    );
    if (res.changes === 0) throw new AppError('entry.locked');
    return;
  }
  await db.runAsync(
    `INSERT INTO entries (client_id, date, description, qty, unit, unit_price_minor, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    e.client_id, e.date, e.description, e.qty, e.unit, e.unit_price_minor, details,
  );
}

export async function deleteEntry(db: SQLiteDatabase, id: number): Promise<void> {
  const res = await db.runAsync('DELETE FROM entries WHERE id = ? AND bill_id IS NULL', id);
  if (res.changes === 0) throw new AppError('entry.lockedDelete');
}

/**
 * Turns a client's unbilled entries in the period into one bill and marks them billed, atomically,
 * so an entry can never land on two bills.
 */
export async function createPeriodBill(db: SQLiteDatabase, clientId: number, period: Period, date: string): Promise<number> {
  let billId = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const client = await getClient(txn, clientId);
    if (!client) throw new AppError('client.notFound');
    const profile = await txn.getFirstAsync<{ trade: Trade }>('SELECT trade FROM profile WHERE id = 1');
    const rows = await txn.getAllAsync<EntryRow>(
      `SELECT id, client_id, date, description, qty, unit, unit_price_minor, details, bill_id, NULL AS bill_no
       FROM entries WHERE client_id = ? AND bill_id IS NULL AND date BETWEEN ? AND ?
       ORDER BY date, id`,
      clientId, period.start, period.end,
    );
    if (rows.length === 0) throw new AppError('client.noEntriesInPeriod');
    const entries = rows.map((r) => ({ ...r, details: parseJson<Details>(r.details, {}) }));
    const fields = presetFor(profile?.trade ?? 'general').entryFields;
    billId = await insertBill(txn, periodBillDraft({ client, entries, period, fields, date }));
    for (const e of entries) {
      await txn.runAsync('UPDATE entries SET bill_id = ? WHERE id = ?', billId, e.id);
    }
  });
  return billId;
}

/** Bills made for a client in a period, oldest first, for a statement of account. */
export async function listClientBills(db: SQLiteDatabase, clientId: number, period: Period): Promise<Bill[]> {
  const rows = await db.getAllAsync<BillRow>(
    `SELECT * FROM bills WHERE client_id = ? AND date BETWEEN ? AND ? ORDER BY date, id`,
    clientId, period.start, period.end,
  );
  return rows.map(toBill);
}
