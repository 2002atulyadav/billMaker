import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { BillThemePicker } from '@/components/BillThemePicker';
import { Card, SectionTitle, T } from '@/components/ui';
import { setBillTheme } from '@/db/repo';
import { useT } from '@/i18n/I18nProvider';
import { isAccent, isBillTheme, type AccentId, type BillThemeId } from '@/lib/billTheme';
import type { Profile } from '@/types';

/** Settings: change the bill design. Saved at once; every bill shared from now on uses it. */
export function BillThemeCard({ profile }: { profile: Profile }) {
  const db = useSQLiteContext();
  const { t } = useT();
  const [theme, setTheme] = useState<BillThemeId>(isBillTheme(profile.bill_theme) ? profile.bill_theme : 'classic');
  const [accent, setAccent] = useState<AccentId>(isAccent(profile.bill_accent) ? profile.bill_accent : 'blue');

  async function change(nextTheme: BillThemeId, nextAccent: AccentId) {
    setTheme(nextTheme);
    setAccent(nextAccent);
    await setBillTheme(db, nextTheme, nextAccent);
  }

  return (
    <Card>
      <SectionTitle>{t('billStyle.title')}</SectionTitle>
      <T muted style={{ fontSize: 12 }}>{t('billStyle.hint')}</T>
      <BillThemePicker profile={profile} theme={theme} accent={accent} onChange={change} />
    </Card>
  );
}
