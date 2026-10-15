import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { restoreBackup } from '@/db/repo';
import { isLang } from '@/i18n';
import { useT } from '@/i18n/I18nProvider';
import { backupSummary, type Backup } from '@/lib/backup';
import { pickBackup } from '@/lib/backupFiles';
import { errorText } from '@/lib/errors';
import { formatDate } from '@/lib/money';

/** Pick a backup file, show what's in it, and replace all data once the user confirms. */
export function useRestore(onRestored: () => void | Promise<void>) {
  const db = useSQLiteContext();
  const { t, lang, setLang } = useT();
  const [busy, setBusy] = useState(false);

  async function apply(backup: Backup) {
    setBusy(true);
    try {
      await restoreBackup(db, backup);
      const restoredLang = backup.tables.profile[0]?.language;
      if (isLang(restoredLang)) setLang(restoredLang);
      await onRestored();
      Alert.alert(t('backup.restored'), t('backup.restoredMessage'));
    } catch (e) {
      Alert.alert(t('backup.restoreFailed'), errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    let backup: Backup | null;
    try {
      backup = await pickBackup();
    } catch (e) {
      Alert.alert(t('backup.restoreFailed'), errorText(t, e));
      return;
    }
    if (!backup) return;
    const s = backupSummary(backup);
    const picked = backup;
    Alert.alert(
      t('backup.restoreTitle'),
      t('backup.restoreConfirm', {
        business: s.business,
        date: s.created ? formatDate(s.created, lang) : '—',
        bills: s.bills,
        items: s.items,
        clients: s.clients,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('backup.restoreAction'), style: 'destructive', onPress: () => apply(picked) },
      ],
    );
  }

  return { restore, busy };
}
