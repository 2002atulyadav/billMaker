import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useAppLock } from '@/components/AppLock';
import { AppLockCard } from '@/components/AppLockCard';
import { BackupCard } from '@/components/BackupCard';
import { BillNumberCard } from '@/components/BillNumberCard';
import { BusinessTypeCard } from '@/components/BusinessTypeCard';
import { LanguageCard } from '@/components/LanguageCard';
import { ProfileForm } from '@/components/ProfileForm';
import { Screen } from '@/components/ui';
import { saveProfile } from '@/db/repo';
import { useProfileState } from '@/hooks/use-profile';
import { useT } from '@/i18n/I18nProvider';

export default function Settings() {
  const db = useSQLiteContext();
  const [profile, reload] = useProfileState();
  const { t } = useT();
  const [savedCount, setSavedCount] = useState(0);
  // Bumped after a restore so every form re-reads the restored profile.
  const [generation, setGeneration] = useState(0);
  const lock = useAppLock();
  if (!profile) return null;

  return (
    <Screen key={generation}>
        <ProfileForm
          initial={profile}
          submitLabel={t('profile.saveChanges')}
          onSubmit={async (p) => {
            await saveProfile(db, p);
            setSavedCount((n) => n + 1);
            Alert.alert(t('common.saved'), t('profile.savedMessage'));
          }}
        />
        <LanguageCard billLanguage={profile.bill_language} />
        <BusinessTypeCard trade={profile.trade} />
        <BillNumberCard version={savedCount} />
        <AppLockCard />
        <BackupCard
          profile={profile}
          onBackedUp={reload}
          onRestored={async () => {
            await reload();
            lock.refresh();
            setGeneration((g) => g + 1);
          }}
        />
    </Screen>
  );
}
