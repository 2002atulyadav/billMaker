import type { SQLiteDatabase } from 'expo-sqlite';

import { computeTotals, formatBillNo, lineTotal, minNextBillNo } from '@/lib/money';
import { presetFor } from '@/lib/presets';
import type {
  Bill,
  BillDraft,
  BillLine,
  BillStatus,
  BillWithLines,
  Item,
  Profile,
  ProfileInput,
  Trade,
  Unit,
} from '@/types';

// ---- profile ----

export function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  return db.getFirstAsync<Profile>(
    `SELECT business_name, owner_name, phone, address, logo_uri, currency, bill_prefix, upi_id, trade, next_bill_no
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

/** First-run setup: creates the profile and seeds the trade's starter items in one transaction. */
export async function completeOnboarding(db: SQLiteDatabase, p: ProfileInput, trade: Trade): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await saveProfile(txn, p);
    await txn.runAsync('UPDATE profile SET trade = ? WHERE id = 1', trade);
    for (const item of presetFor(trade).items) {
      await txn.runAsync(
        'INSERT INTO items (name, price_minor, unit) VALUES (?, ?, ?)',
        item.name, item.price_minor, item.unit,
      );
    }
  });
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
      throw new Error(`Next bill number must be ${min} or higher so it doesn't repeat an existing bill.`);
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

export function listBills(db: SQLiteDatabase, search: string, filter: BillFilter = 'all'): Promise<Bill[]> {
  const q = likePattern(search);
  return db.getAllAsync<Bill>(
    `SELECT * FROM bills
     WHERE (bill_no LIKE ?1 ESCAPE '\\' OR customer_name LIKE ?1 ESCAPE '\\' OR customer_phone LIKE ?1 ESCAPE '\\')
       AND (?2 = 'all' OR status = ?2)
     ORDER BY id DESC`,
    q, filter,
  );
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
  const bill = await db.getFirstAsync<Bill>('SELECT * FROM bills WHERE id = ?', id);
  if (!bill) return null;
  const lines = await db.getAllAsync<BillLine>(
    `SELECT description, qty, unit, unit_price_minor, line_total_minor
     FROM bill_items WHERE bill_id = ? ORDER BY position`,
    id,
  );
  return { ...bill, lines };
}

/**
 * Allocates the next bill number and writes the bill and its lines atomically.
 * Totals are recomputed here rather than trusted from the UI.
 */
export async function createBill(db: SQLiteDatabase, draft: BillDraft): Promise<number> {
  const totals = computeTotals(draft.lines, draft.discount_minor);
  let billId = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const p = await txn.getFirstAsync<{ bill_prefix: string; next_bill_no: number }>(
      'SELECT bill_prefix, next_bill_no FROM profile WHERE id = 1',
    );
    if (!p) throw new Error('Business profile is not set up');
    const billNo = formatBillNo(p.bill_prefix, p.next_bill_no);
    const res = await txn.runAsync(
      `INSERT INTO bills (bill_no, customer_name, customer_phone, date, discount_minor, notes, subtotal_minor, total_minor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      billNo, draft.customer_name, draft.customer_phone, draft.date,
      totals.discount, draft.notes, totals.subtotal, totals.total,
    );
    billId = res.lastInsertRowId;
    for (const [i, l] of draft.lines.entries()) {
      await txn.runAsync(
        `INSERT INTO bill_items (bill_id, position, description, qty, unit, unit_price_minor, line_total_minor)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        billId, i, l.description, l.qty, l.unit, l.unit_price_minor, lineTotal(l.qty, l.unit_price_minor),
      );
    }
    await txn.runAsync('UPDATE profile SET next_bill_no = next_bill_no + 1 WHERE id = 1');
  });
  return billId;
}

export async function deleteBill(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM bills WHERE id = ?', id);
}
