import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { getProfile, setLanguage } from '@/db/repo';
import { deviceLang, isLang, makeTranslator, type Translator } from '@/i18n';
import type { Lang } from '@/types';

type I18n = Translator & {
  /** Switches the app language; saved to the profile once one exists (onboarding saves it on finish). */
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<I18n | null>(null);

/** Must sit inside SQLiteProvider: the chosen language lives on the profile row. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  // Read synchronously so the first frame is already in the saved language (no flash of the device language).
  const [lang, setLangState] = useState<Lang>(() => {
    const row = db.getFirstSync<{ language: string }>('SELECT language FROM profile WHERE id = 1');
    return isLang(row?.language) ? row.language : deviceLang();
  });

  const value: I18n = {
    ...makeTranslator(lang),
    setLang: (next) => {
      setLangState(next);
      getProfile(db).then((p) => p && setLanguage(db, next));
    },
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside I18nProvider');
  return ctx;
}
