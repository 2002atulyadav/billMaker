import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { canLock, confirmOwner, useAppLock } from '@/components/AppLock';
import { Card, Row, SectionTitle, T } from '@/components/ui';
import { setAppLock } from '@/db/repo';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';

/** Settings switch for the app lock. Turning it on or off needs the owner's fingerprint / face / passcode. */
export function AppLockCard() {
  const db = useSQLiteContext();
  const c = useTheme();
  const { t } = useT();
  const { enabled, refresh } = useAppLock();
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    canLock().then(setAvailable);
  }, []);

  async function toggle(next: boolean) {
    if (!(await confirmOwner(t('lock.prompt')))) return;
    await setAppLock(db, next);
    refresh();
  }

  return (
    <Card>
      <SectionTitle>{t('lock.title')}</SectionTitle>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '600' }}>{t('lock.toggle')}</T>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={!available}
          trackColor={{ true: c.primary }}
          accessibilityLabel={t('lock.toggle')}
        />
      </Row>
      <T muted style={{ fontSize: 12 }}>{available === false ? t('lock.unavailable') : t('lock.hint')}</T>
    </Card>
  );
}
