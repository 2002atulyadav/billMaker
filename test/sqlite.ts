/**
 * expo-sqlite's async API on top of Node's built-in node:sqlite, so tests can run the app's real
 * migrations and repo functions against an in-memory database.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

type Param = string | number | null;

export function openDb(): SQLiteDatabase {
  const d = new DatabaseSync(':memory:');
  const plain = (r: object | undefined) => (r ? { ...r } : null);
  const db = {
    execAsync: async (sql: string) => d.exec(sql),
    getFirstAsync: async (sql: string, ...p: Param[]) => plain(d.prepare(sql).get(...p)),
    getAllAsync: async (sql: string, ...p: Param[]) => d.prepare(sql).all(...p).map((r: object) => ({ ...r })),
    runAsync: async (sql: string, ...p: Param[]) => {
      const r = d.prepare(sql).run(...p);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    withTransactionAsync: async (fn: () => Promise<void>) => tx('BEGIN', fn),
    withExclusiveTransactionAsync: async (fn: (txn: unknown) => Promise<void>) => tx('BEGIN EXCLUSIVE', () => fn(db)),
  };
  async function tx(begin: string, fn: () => Promise<void>) {
    d.exec(begin);
    try {
      await fn();
      d.exec('COMMIT');
    } catch (e) {
      d.exec('ROLLBACK');
      throw e;
    }
  }
  return db as unknown as SQLiteDatabase;
}
