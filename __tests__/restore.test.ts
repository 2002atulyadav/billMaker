/**
 * Backup -> restore against a real SQLite database (Node's built-in node:sqlite), running the app's
 * own migrations and repo functions through a small adapter that mimics expo-sqlite's async API.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { createBill, createPeriodBill, readAllTables, restoreBackup, saveClient, saveEntry, getProfile, completeOnboarding } from '@/db/repo';
import { SCHEMA_VERSION, migrate } from '@/db/schema';
import { makeBackup, parseBackup, type Row } from '@/lib/backup';

import { openDb } from '../test/sqlite';

async function seed(db: SQLiteDatabase) {
  await migrate(db);
  await completeOnboarding(
    db,
    { business_name: 'Sharma Transport', owner_name: 'Ravi', phone: '98765', address: 'Pune', logo_uri: null, currency: '₹', bill_prefix: 'TR-', upi_id: 'ravi@okhdfc' },
    'transport',
    'hi',
  );
  const clientId = await saveClient(db, { name: 'Acme', phone: '11111', address: 'MIDC' });
  await saveEntry(db, { client_id: clientId, date: '2026-09-03', description: 'Trip', qty: 1, unit: 'trip', unit_price_minor: 500000, details: { from: 'Pune', to: 'Mumbai' } });
  await saveEntry(db, { client_id: clientId, date: '2026-10-02', description: 'Trip', qty: 2, unit: 'trip', unit_price_minor: 500000, details: {} });
  await createPeriodBill(db, clientId, { start: '2026-09-01', end: '2026-09-30' }, '2026-10-01');
  await createBill(db, {
    customer_name: 'Walk-in', customer_phone: '', date: '2026-10-05', discount_minor: 0, notes: 'cash',
    lines: [{ description: 'Loading', qty: 1, unit: 'trip', unit_price_minor: 50000 }],
  });
  return clientId;
}

const withoutBackupDate = (t: Record<string, Row[]>) => ({
  ...t,
  profile: t.profile.map(({ last_backup_at: _l, ...p }) => p),
});

describe('restoreBackup', () => {
  it('brings back exactly what was backed up', async () => {
    const db = openDb();
    await seed(db);
    const before = await readAllTables(db);
    const file = JSON.stringify(makeBackup(before, SCHEMA_VERSION, new Date('2026-10-16T10:00:00Z')));

    // Things change after the backup...
    await db.runAsync('DELETE FROM bills');
    await db.runAsync(`UPDATE profile SET business_name = 'Other', next_bill_no = 99`);
    await createBill(db, { customer_name: 'New', customer_phone: '', date: '2026-10-10', discount_minor: 0, notes: '', lines: [{ description: 'x', qty: 1, unit: '', unit_price_minor: 100 }] });

    await restoreBackup(db, parseBackup(file, SCHEMA_VERSION));
    const after = await readAllTables(db);
    expect(withoutBackupDate(after)).toEqual(withoutBackupDate(before));
    expect(after.profile[0].last_backup_at).toBe('2026-10-16T10:00:00.000Z');
    expect(after.entries.filter((e) => e.bill_id !== null)).toHaveLength(1);

    // Numbering carries on from the restored counter, without reusing a restored bill number.
    const id = await createBill(db, { customer_name: '', customer_phone: '', date: '2026-10-16', discount_minor: 0, notes: '', lines: [{ description: 'y', qty: 1, unit: '', unit_price_minor: 100 }] });
    const nos = (await readAllTables(db)).bills.map((b) => b.bill_no);
    expect(new Set(nos).size).toBe(nos.length);
    expect(id).toBeGreaterThan(Math.max(...before.bills.map((b) => Number(b.id))));
  });

  it('restores a backup from an older app version with defaults for newer columns', async () => {
    const db = openDb();
    await seed(db);
    const current = await readAllTables(db);
    // What a version-1 app (before payments, trades, clients and languages) would have written.
    const keep = (rows: Row[], cols: string[]) => rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
    const v1 = {
      ...makeBackup(current, 1),
      tables: {
        profile: keep(current.profile, ['id', 'business_name', 'owner_name', 'phone', 'address', 'logo_uri', 'currency', 'bill_prefix', 'next_bill_no']),
        items: keep(current.items, ['id', 'name', 'price_minor', 'unit', 'created_at']),
        bills: keep(current.bills, ['id', 'bill_no', 'customer_name', 'customer_phone', 'date', 'discount_minor', 'notes', 'subtotal_minor', 'total_minor', 'created_at']),
        bill_items: keep(current.bill_items, ['id', 'bill_id', 'position', 'description', 'qty', 'unit', 'unit_price_minor', 'line_total_minor']),
      },
    };
    await restoreBackup(db, parseBackup(JSON.stringify(v1), SCHEMA_VERSION));
    const p = await getProfile(db);
    expect(p).toMatchObject({ business_name: 'Sharma Transport', upi_id: '', trade: 'general', language: 'en', bill_language: 'en' });
    const after = await readAllTables(db);
    expect(after.bills.map((b) => b.status)).toEqual(['unpaid', 'unpaid']);
    expect(after.clients).toEqual([]);
    expect(after.entries).toEqual([]);
    expect(after.bill_items).toHaveLength(current.bill_items.length);
  });

  it('ignores columns this version does not know', async () => {
    const db = openDb();
    await seed(db);
    const t = await readAllTables(db);
    const b = makeBackup({ ...t, items: t.items.map((i) => ({ ...i, colour: 'red' })) }, SCHEMA_VERSION);
    await restoreBackup(db, parseBackup(JSON.stringify(b), SCHEMA_VERSION));
    expect((await readAllTables(db)).items).toEqual(t.items);
  });

  it('leaves current data untouched when the backup is broken', async () => {
    const db = openDb();
    await seed(db);
    const before = await readAllTables(db);
    // A line pointing at a bill that isn't in the file violates the foreign key.
    const broken = makeBackup({ ...before, bills: [] }, SCHEMA_VERSION);
    await expect(restoreBackup(db, parseBackup(JSON.stringify(broken), SCHEMA_VERSION))).rejects.toThrow();
    expect(await readAllTables(db)).toEqual(before);
  });
});
