import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { BillNumberCard } from '@/components/BillNumberCard';
import { BusinessTypeCard } from '@/components/BusinessTypeCard';
import { LanguageCard } from '@/components/LanguageCard';
import { ProfileForm } from '@/components/ProfileForm';
import { Spacing } from '@/constants/theme';
import { saveProfile } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';
import { useT } from '@/i18n/I18nProvider';

export default function Settings() {
  const db = useSQLiteContext();
  const profile = useProfile();
  const { t } = useT();
  const [savedCount, setSavedCount] = useState(0);
  if (!profile) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }} keyboardShouldPersistTaps="handled">
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
