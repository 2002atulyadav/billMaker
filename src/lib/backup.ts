import { AppError } from '@/lib/errors';

/**
 * A backup is every table dumped as JSON rows. JSON (rather than a copy of the SQLite file) can be
 * restored into a newer app version: columns added since are filled with their defaults, and columns
 * the app no longer has are skipped.
 */

/** In foreign-key order: parents before children. Restore inserts in this order and deletes in reverse. */
export const BACKUP_TABLES = ['profile', 'items', 'clients', 'bills', 'bill_items', 'entries', 'payments'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export type Backup = {
  /** 'dhanzo'; files from before the rename say 'bill-maker' and are still accepted */
  app: 'dhanzo' | 'bill-maker';
  /** version of this file layout */
  format: 1;
  /** PRAGMA user_version of the database it came from */
  schema_version: number;
  /** ISO timestamp */
  created_at: string;
  tables: Record<BackupTable, Row[]>;
};

export function makeBackup(tables: Record<BackupTable, Row[]>, schemaVersion: number, now = new Date()): Backup {
  return { app: 'dhanzo', format: 1, schema_version: schemaVersion, created_at: now.toISOString(), tables };
}

/** "Dhanzo-backup-2026-10-16.json" */
export function backupFileName(now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `Dhanzo-backup-${d}.json`;
}

const isCell = (v: unknown): v is Cell => v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
const isRow = (v: unknown): v is Row =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every(isCell);

/**
 * Checks a picked file is a backup this app can restore. Throws AppError so the screen can explain:
 * not a backup at all, or made by a newer version of the app.
 */
export function parseBackup(text: string, currentSchemaVersion: number): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new AppError('backup.errInvalid');
  }
  const b = data as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || (b.app !== 'dhanzo' && b.app !== 'bill-maker') || typeof b.tables !== 'object' || b.tables === null) {
    throw new AppError('backup.errInvalid');
  }
  if (b.format !== 1 || typeof b.schema_version !== 'number' || b.schema_version > currentSchemaVersion) {
    throw new AppError('backup.errNewer');
  }
  const tables = {} as Record<BackupTable, Row[]>;
  for (const name of BACKUP_TABLES) {
    // Tables added after the backup was made are simply empty.
    const rows = (b.tables as Record<string, unknown>)[name] ?? [];
    if (!Array.isArray(rows) || !rows.every(isRow)) throw new AppError('backup.errInvalid');
    tables[name] = rows;
  }
  const profile = tables.profile;
  if (profile.length !== 1 || typeof profile[0].business_name !== 'string') throw new AppError('backup.errInvalid');
  return {
    app: 'dhanzo',
    format: 1,
    schema_version: b.schema_version,
    created_at: typeof b.created_at === 'string' ? b.created_at : '',
    tables,
  };
}

export type BackupSummary = { business: string; bills: number; items: number; clients: number; created: string };

/** What the restore confirmation shows. `created` is the local "YYYY-MM-DD" the backup was made. */
export function backupSummary(b: Backup): BackupSummary {
  const d = new Date(b.created_at);
  const created = Number.isNaN(d.getTime())
    ? ''
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    business: String(b.tables.profile[0]?.business_name ?? ''),
    bills: b.tables.bills.length,
    items: b.tables.items.length,
    clients: b.tables.clients.length,
    created,
  };
}

/** Whole days since the last backup, or null if there has never been one. `lastBackupAt` is SQLite's UTC datetime('now'). */
export function daysSinceBackup(lastBackupAt: string | null, now = new Date()): number | null {
  if (!lastBackupAt) return null;
  const then = new Date(lastBackupAt.includes('T') ? lastBackupAt : `${lastBackupAt.replace(' ', 'T')}Z`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

/** Nudge once there's something worth losing and the last backup is old (or never happened). */
export function needsBackupReminder(billCount: number, lastBackupAt: string | null, now = new Date()): boolean {
  if (billCount < 5) return false;
  const days = daysSinceBackup(lastBackupAt, now);
  return days === null || days >= 30;
}
