import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { ExportSheet } from '@/components/ExportSheet';
import { Button, Card, SectionTitle, T } from '@/components/ui';
import { useRestore } from '@/hooks/use-restore';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import { daysSinceBackup } from '@/lib/backup';
import { shareBackup } from '@/lib/backupFiles';
import { errorText } from '@/lib/errors';
import type { Profile } from '@/types';

/**
 * Everything lives only on this phone, so this is the one place to get it off: a full backup file
 * (restorable on any phone), restore, and spreadsheet export for an accountant.
 */
export function BackupCard({
  profile,
  onBackedUp,
  onRestored,
}: {
  profile: Profile;
  onBackedUp: () => void;
  onRestored: () => Promise<void>;
}) {
  const db = useSQLiteContext();
  const c = useTheme();
  const { t, tn } = useT();
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { restore, busy } = useRestore(onRestored);

  const days = daysSinceBackup(profile.last_backup_at);
  const status =
    days === null ? t('backup.never') : days === 0 ? t('backup.today') : tn('backup.daysAgo', days);

  async function backUp() {
    setSaving(true);
    try {
      await shareBackup(db, t('backup.shareTitle'));
      onBackedUp();
    } catch (e) {
      Alert.alert(t('backup.failed'), errorText(t, e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionTitle>{t('backup.title')}</SectionTitle>
      <T style={{ color: days === null || days >= 30 ? c.warning : c.textSecondary, fontSize: 13 }}>{status}</T>
      <Button
        title={t('backup.backUpNow')}
        icon={<Ionicons name="cloud-upload-outline" size={18} color={c.primaryText} />}
        onPress={backUp}
        loading={saving}
      />
      <T muted style={{ fontSize: 12 }}>{t('backup.hint')}</T>
      <Button
        title={t('backup.restore')}
        variant="secondary"
        icon={<Ionicons name="cloud-download-outline" size={18} color={c.primary} />}
        onPress={restore}
        loading={busy}
      />
      <Button
        title={t('export.button')}
        variant="secondary"
        icon={<Ionicons name="document-text-outline" size={18} color={c.primary} />}
        onPress={() => setExportOpen(true)}
      />
      <ExportSheet visible={exportOpen} profile={profile} onClose={() => setExportOpen(false)} />
    </Card>
  );
}
