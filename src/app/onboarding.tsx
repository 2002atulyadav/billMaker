import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { ProfileForm } from '@/components/ProfileForm';
import { T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { saveProfile } from '@/db/repo';

export default function Onboarding() {
  const db = useSQLiteContext();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }} keyboardShouldPersistTaps="handled">
        <T muted>These details appear at the top of every bill you share. You can change them later in Settings.</T>
        <ProfileForm
          submitLabel="Start making bills"
          onSubmit={async (p) => {
            await saveProfile(db, p);
            router.replace('/');
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
