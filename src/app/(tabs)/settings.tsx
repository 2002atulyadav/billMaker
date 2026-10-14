import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { BillNumberCard } from '@/components/BillNumberCard';
import { ProfileForm } from '@/components/ProfileForm';
import { Spacing } from '@/constants/theme';
import { saveProfile } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';

export default function Settings() {
  const db = useSQLiteContext();
  const profile = useProfile();
  const [savedCount, setSavedCount] = useState(0);
  if (!profile) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }} keyboardShouldPersistTaps="handled">
        <ProfileForm
          initial={profile}
          submitLabel="Save changes"
          onSubmit={async (p) => {
            await saveProfile(db, p);
            setSavedCount((n) => n + 1);
            Alert.alert('Saved', 'Your business profile has been updated.');
          }}
        />
        <BillNumberCard version={savedCount} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
