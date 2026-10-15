import { backupFileName, backupSummary, daysSinceBackup, makeBackup, needsBackupReminder, parseBackup } from '@/lib/backup';
import { AppError } from '@/lib/errors';

const profile = { id: 1, business_name: 'Sharma Transport', language: 'hi', next_bill_no: 4 };
const tables = {
  profile: [profile],
  items: [{ id: 1, name: 'Trip', price_minor: 500000, unit: 'trip' }],
  clients: [{ id: 1, name: 'Acme', phone: '', address: '' }],
  bills: [{ id: 1, bill_no: 'TR-0001' }, { id: 2, bill_no: 'TR-0002' }],
  bill_items: [],
  entries: [],
};

const errKey = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.key : String(e);
  }
  return null;
};

describe('backup file', () => {
  it('round-trips through JSON', () => {
    const b = makeBackup(tables, 6, new Date('2026-10-16T10:00:00Z'));
    expect(parseBackup(JSON.stringify(b), 6)).toEqual(b);
  });

  it('accepts an older backup and fills tables it did not have', () => {
    const { clients: _c, entries: _e, ...old } = tables;
    const b = { ...makeBackup(tables, 3), tables: old };
    const parsed = parseBackup(JSON.stringify(b), 6);
    expect(parsed.tables.clients).toEqual([]);
    expect(parsed.tables.entries).toEqual([]);
    expect(parsed.tables.bills).toHaveLength(2);
  });

  it('tolerates a byte-order mark', () => {
    expect(parseBackup('﻿' + JSON.stringify(makeBackup(tables, 6)), 6).tables.items).toHaveLength(1);
  });

  it('rejects files that are not backups', () => {
    expect(errKey(() => parseBackup('not json', 6))).toBe('backup.errInvalid');
    expect(errKey(() => parseBackup('{"hello":1}', 6))).toBe('backup.errInvalid');
    expect(errKey(() => parseBackup('null', 6))).toBe('backup.errInvalid');
    const noProfile = makeBackup({ ...tables, profile: [] }, 6);
    expect(errKey(() => parseBackup(JSON.stringify(noProfile), 6))).toBe('backup.errInvalid');
    const nested = makeBackup({ ...tables, items: [{ id: 1, name: { evil: true } as never }] }, 6);
    expect(errKey(() => parseBackup(JSON.stringify(nested), 6))).toBe('backup.errInvalid');
    const notArray = { ...makeBackup(tables, 6), tables: { ...tables, bills: 'x' } };
    expect(errKey(() => parseBackup(JSON.stringify(notArray), 6))).toBe('backup.errInvalid');
  });

  it('refuses a backup from a newer app', () => {
    expect(errKey(() => parseBackup(JSON.stringify(makeBackup(tables, 7)), 6))).toBe('backup.errNewer');
  });

  it('summarises what will be restored', () => {
    const b = makeBackup(tables, 6, new Date(2026, 9, 16, 22, 30));
    expect(backupSummary(b)).toEqual({ business: 'Sharma Transport', bills: 2, items: 1, clients: 1, created: '2026-10-16' });
  });

  it('names the file by date', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('BillMaker-backup-2026-01-05.json');
  });
});

describe('backup reminder', () => {
  const now = new Date('2026-10-16T12:00:00Z');

  it('counts days from SQLite and ISO timestamps', () => {
    expect(daysSinceBackup(null, now)).toBeNull();
    expect(daysSinceBackup('2026-10-16 01:00:00', now)).toBe(0);
    expect(daysSinceBackup('2026-10-06 12:00:00', now)).toBe(10);
    expect(daysSinceBackup('2026-09-01T00:00:00.000Z', now)).toBe(45);
    expect(daysSinceBackup('garbage', now)).toBeNull();
  });

  it('nudges only when there is something to lose', () => {
    expect(needsBackupReminder(2, null, now)).toBe(false);
    expect(needsBackupReminder(5, null, now)).toBe(true);
    expect(needsBackupReminder(50, '2026-10-01 00:00:00', now)).toBe(false);
    expect(needsBackupReminder(50, '2026-09-01 00:00:00', now)).toBe(true);
  });
});
