import type { SQLiteDatabase } from 'expo-sqlite';

import { BACKUP_TABLES, type Backup, type BackupTable, type Row } from '@/lib/backup';
import type { AccentId, BillThemeId } from '@/lib/billTheme';
import { BACKFILL_PAYMENTS } from '@/db/schema';
import { computeTotals, formatBillNo, lineTotal, minNextBillNo, todayISO } from '@/lib/money';
import { periodBillDraft } from '@/lib/entries';
import { AppError } from '@/lib/errors';
import type { Period } from '@/lib/period';
import { presetFor, presetItemName } from '@/lib/presets';
import type {
  Bill,
  BillDraft,
  BillLang,
  BillLine,
  BillWithLines,
  Client,
  DetailField,
  Details,
  Entry,
  Item,
  Lang,
  Payment,
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
            language, bill_language, next_bill_no, last_backup_at, app_lock, bill_theme, bill_accent
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
export async function completeOnboarding(
  db: SQLiteDatabase,
  p: ProfileInput,
  trade: Trade,
  lang: Lang,
  theme: { theme: BillThemeId; accent: AccentId } = { theme: 'classic', accent: 'blue' },
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await saveProfile(txn, p);
    await txn.runAsync(
      'UPDATE profile SET trade = ?, language = ?, bill_language = ?, bill_theme = ?, bill_accent = ? WHERE id = 1',
      trade, lang, lang, theme.theme, theme.accent,
    );
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

/** 'unpaid' includes part-paid bills; 'overdue' is anything not fully paid past its due date. */
export type BillFilter = 'all' | 'unpaid' | 'paid' | 'overdue';

/** Escapes LIKE wildcards so searching for "50%" or "A_1" matches literally. */
export function likePattern(search: string): string {
  return `%${search.trim().replace(/[\\%_]/g, (ch) => '\\' + ch)}%`;
}

type BillRow = Omit<Bill, 'detail_fields'> & { detail_fields: string };

function toBill(row: BillRow): Bill {
  return { ...row, detail_fields: parseJson<DetailField[]>(row.detail_fields, []) };
}

export async function listBills(
  db: SQLiteDatabase,
  search: string,
  filter: BillFilter = 'all',
  today = todayISO(),
): Promise<Bill[]> {
  const q = likePattern(search);
  const rows = await db.getAllAsync<BillRow>(
    `SELECT * FROM bills
     WHERE (bill_no LIKE ?1 ESCAPE '\\' OR customer_name LIKE ?1 ESCAPE '\\' OR customer_phone LIKE ?1 ESCAPE '\\')
       AND (?2 = 'all'
         OR (?2 = 'unpaid' AND status <> 'paid')
         OR (?2 = 'paid' AND status = 'paid')
         OR (?2 = 'overdue' AND status <> 'paid' AND due_date IS NOT NULL AND due_date < ?3))
     ORDER BY id DESC`,
    q, filter, today,
  );
  return rows.map(toBill);
}

export type DueSummary = { count: number; total_minor: number; overdue_count: number };

/** What's still owed across bills that aren't fully paid (balances, so part payments count). */
export async function getUnpaidSummary(db: SQLiteDatabase, today = todayISO()): Promise<DueSummary> {
  const row = await db.getFirstAsync<{ count: number; total_minor: number | null; overdue_count: number | null }>(
    `SELECT COUNT(*) AS count, SUM(total_minor - paid_minor) AS total_minor,
            SUM(CASE WHEN due_date IS NOT NULL AND due_date < ? THEN 1 ELSE 0 END) AS overdue_count
     FROM bills WHERE status <> 'paid'`,
    today,
  );
  return { count: row?.count ?? 0, total_minor: row?.total_minor ?? 0, overdue_count: row?.overdue_count ?? 0 };
}

// ---- payments ----

/**
 * Recomputes the paid amount and status from the payments table. Always run inside the transaction that
 * changed the payments, so the cache can't drift. A zero-total bill keeps whatever status it was given.
 */
export const REFRESH_PAYMENT_STATUS = `
  UPDATE bills SET paid_minor = COALESCE((SELECT SUM(amount_minor) FROM payments WHERE bill_id = bills.id), 0)
    WHERE ?1 IS NULL OR id = ?1;
  UPDATE bills SET
    status = CASE WHEN total_minor = 0 THEN status
                  WHEN paid_minor >= total_minor THEN 'paid'
                  WHEN paid_minor > 0 THEN 'partial' ELSE 'unpaid' END,
    paid_at = CASE WHEN total_minor > 0 AND paid_minor >= total_minor THEN COALESCE(paid_at, datetime('now'))
                   WHEN total_minor = 0 THEN paid_at ELSE NULL END
    WHERE ?1 IS NULL OR id = ?1;
`;

async function refreshPaymentStatus(txn: SQLiteDatabase, billId: number | null): Promise<void> {
  for (const sql of REFRESH_PAYMENT_STATUS.split(';').map((s) => s.trim()).filter(Boolean)) {
    await txn.runAsync(sql, billId);
  }
}

export type PaymentInput = Omit<Payment, 'id' | 'bill_id'>;

/** Records money received. Refuses more than the bill's remaining balance. */
export async function recordPayment(db: SQLiteDatabase, billId: number, p: PaymentInput): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const bill = await txn.getFirstAsync<{ total_minor: number; paid_minor: number }>(
      'SELECT total_minor, paid_minor FROM bills WHERE id = ?', billId,
    );
    if (!bill) throw new AppError('bill.gone');
    if (p.amount_minor <= 0) throw new AppError('payment.amountInvalid');
    if (p.amount_minor > bill.total_minor - bill.paid_minor) throw new AppError('payment.tooMuch');
    await txn.runAsync(
      'INSERT INTO payments (bill_id, amount_minor, date, method, reference, note) VALUES (?, ?, ?, ?, ?, ?)',
      billId, p.amount_minor, p.date, p.method, p.reference.trim(), p.note.trim(),
    );
    await refreshPaymentStatus(txn, billId);
  });
}

export async function deletePayment(db: SQLiteDatabase, paymentId: number): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<{ bill_id: number }>('SELECT bill_id FROM payments WHERE id = ?', paymentId);
    if (!row) return;
    await txn.runAsync('DELETE FROM payments WHERE id = ?', paymentId);
    await refreshPaymentStatus(txn, row.bill_id);
  });
}

/** One-tap "Mark as paid": records whatever is still due. */
export async function markBillPaid(db: SQLiteDatabase, billId: number, date = todayISO()): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const bill = await txn.getFirstAsync<{ total_minor: number; paid_minor: number }>(
      'SELECT total_minor, paid_minor FROM bills WHERE id = ?', billId,
    );
    if (!bill) throw new AppError('bill.gone');
    const balance = bill.total_minor - bill.paid_minor;
    if (balance > 0) {
      await txn.runAsync('INSERT INTO payments (bill_id, amount_minor, date, method) VALUES (?, ?, ?, ?)', billId, balance, date, 'other');
    } else if (bill.total_minor === 0) {
      await txn.runAsync(`UPDATE bills SET status = 'paid', paid_at = datetime('now') WHERE id = ?`, billId);
    }
    await refreshPaymentStatus(txn, billId);
  });
}

/** "Mark unpaid": removes every payment recorded against the bill. */
export async function markBillUnpaid(db: SQLiteDatabase, billId: number): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM payments WHERE bill_id = ?', billId);
    await txn.runAsync(`UPDATE bills SET status = 'unpaid', paid_at = NULL WHERE id = ?`, billId);
    await refreshPaymentStatus(txn, billId);
  });
}

export function listPayments(db: SQLiteDatabase, billId: number): Promise<Payment[]> {
  return db.getAllAsync<Payment>(
    'SELECT id, bill_id, amount_minor, date, method, reference, note FROM payments WHERE bill_id = ? ORDER BY date, id',
    billId,
  );
}

export async function markReminded(db: SQLiteDatabase, billId: number): Promise<void> {
  await db.runAsync(`UPDATE bills SET last_reminded_at = datetime('now') WHERE id = ?`, billId);
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
  return {
    ...toBill(row),
    lines: lines.map((l) => ({ ...l, details: parseJson<Details>(l.details, {}) })),
    payments: await listPayments(db, id),
  };
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
                        subtotal_minor, total_minor, period_start, period_end, detail_fields, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    billNo, draft.customer_name, draft.customer_phone, draft.customer_address ?? '', draft.client_id ?? null,
    draft.date, totals.discount, draft.notes, totals.subtotal, totals.total,
    draft.period_start ?? null, draft.period_end ?? null, JSON.stringify(draft.detail_fields ?? []), draft.due_date ?? null,
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

export type ClientSummary = Client & { unbilled_count: number; unbilled_minor: number; due_minor: number };

export function listClients(db: SQLiteDatabase): Promise<ClientSummary[]> {
  // ROUND matches lineTotal() (Math.round) for the non-negative amounts we store.
  return db.getAllAsync<ClientSummary>(
    `SELECT c.id, c.name, c.phone, c.address,
            COUNT(e.id) AS unbilled_count,
            COALESCE(SUM(CAST(ROUND(e.qty * e.unit_price_minor) AS INTEGER)), 0) AS unbilled_minor,
            (SELECT COALESCE(SUM(b.total_minor - b.paid_minor), 0) FROM bills b
             WHERE b.client_id = c.id AND b.status <> 'paid') AS due_minor
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
export async function createPeriodBill(
  db: SQLiteDatabase,
  clientId: number,
  period: Period,
  date: string,
  dueDate: string | null = null,
): Promise<number> {
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
    billId = await insertBill(txn, { ...periodBillDraft({ client, entries, period, fields, date }), due_date: dueDate });
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

// ---- backup & export ----

/** Every row of every table, for a backup file. */
export async function readAllTables(db: SQLiteDatabase): Promise<Record<BackupTable, Row[]>> {
  const out = {} as Record<BackupTable, Row[]>;
  for (const table of BACKUP_TABLES) {
    out[table] = await db.getAllAsync<Row>(`SELECT * FROM ${table} ORDER BY rowid`);
  }
  return out;
}

/**
 * Replaces all data with the backup in one transaction, so a bad file leaves the current data untouched.
 * Only columns that exist in this version of the schema are written; newer columns take their defaults.
 */
export async function restoreBackup(db: SQLiteDatabase, backup: Backup): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const table of [...BACKUP_TABLES].reverse()) {
      await txn.runAsync(`DELETE FROM ${table}`);
    }
    for (const table of BACKUP_TABLES) {
      const cols = new Set(
        (await txn.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name),
      );
      for (const row of backup.tables[table]) {
        const keys = Object.keys(row).filter((k) => cols.has(k));
        if (!keys.length) continue;
        await txn.runAsync(
          `INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          ...keys.map((k) => row[k]),
        );
      }
    }
    // Backups from before payments were recorded: paid bills get one full payment, then every cache is rebuilt.
    if (backup.schema_version < 7) {
      for (const sql of BACKFILL_PAYMENTS.split(';').map((s) => s.trim()).filter(Boolean)) await txn.runAsync(sql);
    }
    await refreshPaymentStatus(txn, null);
    // The data on the phone now matches that backup file. The app lock is a per-phone choice, so it starts off.
    await txn.runAsync('UPDATE profile SET last_backup_at = ?, app_lock = 0 WHERE id = 1', backup.created_at || null);
  });
}

/** Saves the bill design used for every bill and statement the owner shares. */
export async function setBillTheme(db: SQLiteDatabase, theme: BillThemeId, accent: AccentId): Promise<void> {
  await db.runAsync('UPDATE profile SET bill_theme = ?, bill_accent = ? WHERE id = 1', theme, accent);
}

export async function setAppLock(db: SQLiteDatabase, on: boolean): Promise<void> {
  await db.runAsync('UPDATE profile SET app_lock = ? WHERE id = 1', on ? 1 : 0);
}

export async function markBackedUp(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(`UPDATE profile SET last_backup_at = datetime('now') WHERE id = 1`);
}

export async function countBills(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM bills');
  return row?.n ?? 0;
}

/** Bills dated in the period (all bills when null), oldest first, with their lines, for CSV export. */
export type ExportBill = Bill & { lines: BillLine[] };

export async function listBillsForExport(db: SQLiteDatabase, period: Period | null): Promise<ExportBill[]> {
  const rows = await db.getAllAsync<BillRow>(
    `SELECT * FROM bills WHERE ?1 IS NULL OR date BETWEEN ?1 AND ?2 ORDER BY date, id`,
    period?.start ?? null, period?.end ?? null,
  );
  const lines = await db.getAllAsync<Omit<BillLine, 'details'> & { details: string; bill_id: number }>(
    `SELECT bill_id, description, qty, unit, unit_price_minor, line_total_minor, entry_date, details
     FROM bill_items
     WHERE bill_id IN (SELECT id FROM bills WHERE ?1 IS NULL OR date BETWEEN ?1 AND ?2)
     ORDER BY bill_id, position`,
    period?.start ?? null, period?.end ?? null,
  );
  const byBill = new Map<number, BillLine[]>();
  for (const { bill_id, ...l } of lines) {
    const list = byBill.get(bill_id) ?? [];
    list.push({ ...l, details: parseJson<Details>(l.details, {}) });
    byBill.set(bill_id, list);
  }
  return rows.map((r) => ({ ...toBill(r), lines: byBill.get(r.id) ?? [] }));
}
