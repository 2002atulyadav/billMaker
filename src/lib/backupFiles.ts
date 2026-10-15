import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';

import { markBackedUp, readAllTables } from '@/db/repo';
import { SCHEMA_VERSION } from '@/db/schema';
import { backupFileName, makeBackup, parseBackup, type Backup } from '@/lib/backup';
import { assertCanShare } from '@/lib/pdf';

function writeCacheFile(name: string, content: string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  return file;
}

/**
 * Writes every table to a JSON file and opens the share sheet, so the owner can keep it in Google
 * Drive, email or WhatsApp. Counted as backed up once the share sheet closes; we can't see where it went.
 */
export async function shareBackup(db: SQLiteDatabase, dialogTitle: string): Promise<void> {
  const backup = makeBackup(await readAllTables(db), SCHEMA_VERSION);
  const file = writeCacheFile(backupFileName(), JSON.stringify(backup));
  await assertCanShare();
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle });
  await markBackedUp(db);
}

/**
 * Opens the system file picker and reads a backup. Returns null if the user cancels; throws AppError
 * if the file isn't a backup. Any file type is allowed because Drive and WhatsApp often label .json
 * files as plain binary.
 */
export async function pickBackup(): Promise<Backup | null> {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (picked.canceled) return null;
  return parseBackup(await picked.result.text(), SCHEMA_VERSION);
}

export async function shareCsv(name: string, csv: string, dialogTitle: string): Promise<void> {
  const file = writeCacheFile(name, csv);
  await assertCanShare();
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle });
}
