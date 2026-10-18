/** Part payments, balances, overdue and the schema-7 upgrade, against a real SQLite database. */
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  completeOnboarding,
  createBill,
  deletePayment,
  getBill,
  getUnpaidSummary,
  listBills,
  listClients,
  markBillPaid,
  markBillUnpaid,
  recordPayment,
  restoreBackup,
  saveClient,
} from '@/db/repo';
import { SCHEMA_VERSION, migrate } from '@/db/schema';
import { makeBackup, parseBackup } from '@/lib/backup';
import { AppError } from '@/lib/errors';

import { openDb } from '../test/sqlite';

const PROFILE = {
  business_name: 'Sharma Transport', owner_name: '', phone: '', address: '', logo_uri: null,
  currency: '₹', bill_prefix: 'TR-', upi_id: 'ravi@okhdfc',
};

async function setup() {
  const db = openDb();
  await migrate(db);
  await completeOnboarding(db, PROFILE, 'transport', 'en');
  return db;
}

const bill = (db: SQLiteDatabase, total: number, extra: { due_date?: string | null; client_id?: number | null; customer_name?: string } = {}) =>
  createBill(db, {
    customer_name: extra.customer_name ?? 'Acme', customer_phone: '9876543210', date: '2026-10-01', discount_minor: 0, notes: '',
    due_date: extra.due_date ?? null, client_id: extra.client_id ?? null,
    lines: [{ description: 'Trip', qty: 1, unit: 'trip', unit_price_minor: total }],
  });

const pay = (amount: number, extra: Partial<{ method: 'upi' | 'cash' | 'bank' | 'other'; reference: string; date: string }> = {}) => ({
  amount_minor: amount, date: extra.date ?? '2026-10-05', method: extra.method ?? 'upi', reference: extra.reference ?? '', note: '',
});

const errKey = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e instanceof AppError ? e.key : String(e); }
  return null;
};

describe('payments', () => {
  it('moves a bill from unpaid to partly paid to paid', async () => {
    const db = await setup();
    const id = await bill(db, 500000);
    expect(await getBill(db, id)).toMatchObject({ status: 'unpaid', paid_minor: 0, paid_at: null });

    await recordPayment(db, id, pay(200000, { reference: '412345678901' }));
    expect(await getBill(db, id)).toMatchObject({ status: 'partial', paid_minor: 200000, paid_at: null });

    await recordPayment(db, id, pay(300000, { method: 'cash' }));
    const paid = await getBill(db, id);
    expect(paid).toMatchObject({ status: 'paid', paid_minor: 500000 });
    expect(paid?.paid_at).toBeTruthy();
    expect(paid?.payments.map((p) => [p.amount_minor, p.method, p.reference])).toEqual([
      [200000, 'upi', '412345678901'],
      [300000, 'cash', ''],
    ]);

    await deletePayment(db, paid!.payments[1].id);
    expect(await getBill(db, id)).toMatchObject({ status: 'partial', paid_minor: 200000, paid_at: null });
  });

  it('refuses more than the balance, or nothing', async () => {
    const db = await setup();
    const id = await bill(db, 100000);
    await recordPayment(db, id, pay(60000));
    expect(await errKey(recordPayment(db, id, pay(50000)))).toBe('payment.tooMuch');
    expect(await errKey(recordPayment(db, id, pay(0)))).toBe('payment.amountInvalid');
    expect((await getBill(db, id))?.paid_minor).toBe(60000);
  });

  it('marks paid with the remaining balance, and unpaid by removing payments', async () => {
    const db = await setup();
    const id = await bill(db, 100000);
    await recordPayment(db, id, pay(25000));
    await markBillPaid(db, id, '2026-10-09');
    const b = await getBill(db, id);
    expect(b).toMatchObject({ status: 'paid', paid_minor: 100000 });
    expect(b?.payments.map((p) => [p.amount_minor, p.date])).toEqual([[25000, '2026-10-05'], [75000, '2026-10-09']]);
    await markBillUnpaid(db, id);
    expect(await getBill(db, id)).toMatchObject({ status: 'unpaid', paid_minor: 0, payments: [] });
  });

  it('a zero bill can still be marked paid and unpaid', async () => {
    const db = await setup();
    const id = await bill(db, 0);
    await markBillPaid(db, id);
    expect((await getBill(db, id))?.status).toBe('paid');
    await markBillUnpaid(db, id);
    expect((await getBill(db, id))?.status).toBe('unpaid');
  });
});

describe('balances and overdue', () => {
  it('sums balances, counts overdue, and filters', async () => {
    const db = await setup();
    const a = await bill(db, 100000, { due_date: '2026-10-10' }); // overdue
    const b = await bill(db, 200000, { due_date: '2026-10-30' }); // not yet due
    const c = await bill(db, 300000); // no due date
    const d = await bill(db, 400000, { due_date: '2026-10-01' }); // overdue but paid
    await recordPayment(db, a, pay(40000));
    await markBillPaid(db, d);

    const today = '2026-10-18';
    expect(await getUnpaidSummary(db, today)).toEqual({ count: 3, total_minor: 60000 + 200000 + 300000, overdue_count: 1 });
    const ids = async (f: 'all' | 'unpaid' | 'paid' | 'overdue') => (await listBills(db, '', f, today)).map((x) => x.id).sort();
    expect(await ids('unpaid')).toEqual([a, b, c].sort());
    expect(await ids('paid')).toEqual([d]);
    expect(await ids('overdue')).toEqual([a]);
    expect(await ids('all')).toEqual([a, b, c, d].sort());
  });

  it("shows what each client still owes", async () => {
    const db = await setup();
    const cl = await saveClient(db, { name: 'Acme', phone: '1', address: '' });
    const x = await bill(db, 500000, { client_id: cl });
    await bill(db, 100000, { client_id: cl });
    await recordPayment(db, x, pay(150000));
    const [summary] = await listClients(db);
    expect(summary.due_minor).toBe(350000 + 100000);
  });
});

describe('upgrade to schema 7', () => {
  it('gives bills already marked paid a full payment', async () => {
    const db = openDb();
    await migrate(db, 6);
    await completeOnboarding(db, PROFILE, 'transport', 'en');
    // what the old app did: insert a bill, then flip its status
    await db.runAsync(
      `INSERT INTO bills (bill_no, date, subtotal_minor, total_minor, status, paid_at) VALUES ('TR-0001', '2026-09-01', 5000, 5000, 'paid', '2026-09-03 10:00:00')`,
    );
    await db.runAsync(`INSERT INTO bills (bill_no, date, subtotal_minor, total_minor) VALUES ('TR-0002', '2026-09-02', 7000, 7000)`);
    await migrate(db);
    const [paid, unpaid] = [await getBill(db, 1), await getBill(db, 2)];
    expect(paid).toMatchObject({ status: 'paid', paid_minor: 5000 });
    expect(paid?.payments.map((p) => [p.amount_minor, p.date])).toEqual([[5000, '2026-09-03']]);
    expect(unpaid).toMatchObject({ status: 'unpaid', paid_minor: 0, payments: [] });
  });

  it('restoring an old backup keeps paid bills paid', async () => {
    const db = await setup();
    const tables = {
      profile: [{ id: 1, business_name: 'Old Shop', bill_prefix: 'INV-', next_bill_no: 3 }],
      items: [], clients: [], bill_items: [], entries: [], payments: [],
      bills: [
        { id: 1, bill_no: 'INV-0001', date: '2026-01-01', subtotal_minor: 900, total_minor: 900, status: 'paid', paid_at: '2026-01-02 09:00:00' },
        { id: 2, bill_no: 'INV-0002', date: '2026-01-05', subtotal_minor: 400, total_minor: 400, status: 'unpaid', paid_at: null },
      ],
    };
    await restoreBackup(db, parseBackup(JSON.stringify(makeBackup(tables, 6)), SCHEMA_VERSION));
    expect(await getBill(db, 1)).toMatchObject({ status: 'paid', paid_minor: 900 });
    expect((await getBill(db, 1))?.payments).toHaveLength(1);
    expect(await getBill(db, 2)).toMatchObject({ status: 'unpaid', paid_minor: 0 });
  });
});
