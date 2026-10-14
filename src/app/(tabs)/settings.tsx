import { useSQLiteContext } from 'expo-sqlite';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { ProfileForm } from '@/components/ProfileForm';
import { Spacing } from '@/constants/theme';
import { saveProfile } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';

export default function Settings() {
  const db = useSQLiteContext();
  const profile = useProfile();
  if (!profile) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four }} keyboardShouldPersistTaps="handled">
        <ProfileForm
          initial={profile}
          submitLabel="Save changes"
          onSubmit={async (p) => {
            await saveProfile(db, p);
            Alert.alert('Saved', 'Your business profile has been updated.');
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
