import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'billmaker.db';

/**
 * Each entry upgrades the schema by one version. Append new migrations; never edit
 * ones that have shipped, since devices only run the ones above their user_version.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_name TEXT NOT NULL,
    owner_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    logo_uri TEXT,
    currency TEXT NOT NULL DEFAULT '₹',
    bill_prefix TEXT NOT NULL DEFAULT 'INV-',
    next_bill_no INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price_minor INTEGER NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_no TEXT NOT NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    discount_minor INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    subtotal_minor INTEGER NOT NULL,
    total_minor INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    description TEXT NOT NULL,
    qty REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    unit_price_minor INTEGER NOT NULL,
    line_total_minor INTEGER NOT NULL
  );
  CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
  `,
  `
  ALTER TABLE profile ADD COLUMN upi_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE bills ADD COLUMN status TEXT NOT NULL DEFAULT 'unpaid';
  ALTER TABLE bills ADD COLUMN paid_at TEXT;
  `,
  `
  ALTER TABLE profile ADD COLUMN trade TEXT NOT NULL DEFAULT 'general';
  `,
  `
  CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    qty REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    unit_price_minor INTEGER NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_entries_client ON entries(client_id, bill_id, date);
  ALTER TABLE bills ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
  ALTER TABLE bills ADD COLUMN customer_address TEXT NOT NULL DEFAULT '';
  ALTER TABLE bills ADD COLUMN period_start TEXT;
  ALTER TABLE bills ADD COLUMN period_end TEXT;
  ALTER TABLE bills ADD COLUMN detail_fields TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE bill_items ADD COLUMN entry_date TEXT;
  ALTER TABLE bill_items ADD COLUMN details TEXT NOT NULL DEFAULT '{}';
  `,
  `
  ALTER TABLE profile ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
  ALTER TABLE profile ADD COLUMN bill_language TEXT NOT NULL DEFAULT 'en';
  `,
  `
  ALTER TABLE profile ADD COLUMN last_backup_at TEXT;
  `,
];

/** Current schema version; backups record it so a newer backup isn't restored into an older app. */
export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}
