import type { SQLiteDatabase } from 'expo-sqlite';

import { computeTotals, formatBillNo, lineTotal } from '@/lib/money';
import type { Bill, BillDraft, BillLine, BillWithLines, Item, Profile, ProfileInput, Unit } from '@/types';

// ---- profile ----

export function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  return db.getFirstAsync<Profile>(
    `SELECT business_name, owner_name, phone, address, logo_uri, currency, bill_prefix, next_bill_no
     FROM profile WHERE id = 1`,
  );
}

/** Upsert; never touches next_bill_no so the bill numbering survives profile edits. */
export async function saveProfile(db: SQLiteDatabase, p: ProfileInput): Promise<void> {
  await db.runAsync(
    `INSERT INTO profile (id, business_name, owner_name, phone, address, logo_uri, currency, bill_prefix)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       business_name = excluded.business_name, owner_name = excluded.owner_name,
       phone = excluded.phone, address = excluded.address, logo_uri = excluded.logo_uri,
       currency = excluded.currency, bill_prefix = excluded.bill_prefix`,
    p.business_name, p.owner_name, p.phone, p.address, p.logo_uri, p.currency, p.bill_prefix,
  );
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

export function listBills(db: SQLiteDatabase, search: string): Promise<Bill[]> {
  const q = `%${search.trim()}%`;
  return db.getAllAsync<Bill>(
    `SELECT * FROM bills
     WHERE bill_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?
     ORDER BY id DESC`,
    q, q, q,
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
