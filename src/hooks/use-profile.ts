import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getProfile } from '@/db/repo';
import type { Profile } from '@/types';

/** undefined while loading, null when the business profile hasn't been set up yet. Refreshes on focus. */
export function useProfile(): Profile | null | undefined {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getProfile(db).then((p) => active && setProfile(p));
      return () => {
        active = false;
      };
    }, [db]),
  );
  return profile;
}
