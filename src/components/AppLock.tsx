import * as LocalAuthentication from 'expo-local-authentication';
import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';

/** Coming back within this long (e.g. from the share sheet or WhatsApp) doesn't ask again. */
const RELOCK_AFTER_MS = 60_000;

type AppLock = {
  enabled: boolean;
  /** Re-reads the setting from the profile (after it's changed or a backup is restored). */
  refresh: () => void;
};

const AppLockContext = createContext<AppLock | null>(null);

export function useAppLock(): AppLock {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used inside AppLockProvider');
  return ctx;
}

/** True when the phone has a passcode, fingerprint or face set up; the lock falls back to the passcode. */
export async function canLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Asks for fingerprint / Face ID / phone passcode. */
export async function confirmOwner(promptMessage: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage });
    return res.success;
  } catch {
    return false;
  }
}

/**
 * Covers the app with a lock screen on start and after it has been in the background for a while,
 * when the owner has turned the lock on. The app stays mounted underneath, so unlocking returns to the
 * same screen.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const read = () => db.getFirstSync<{ app_lock: number }>('SELECT app_lock FROM profile WHERE id = 1')?.app_lock === 1;
  // Read synchronously so nothing is visible before the lock screen on a cold start.
  const [enabled, setEnabled] = useState(read);
  const [locked, setLocked] = useState(enabled);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current !== null) {
        if (enabled && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const value: AppLock = {
    enabled,
    refresh: () => {
      const on = read();
      setEnabled(on);
      if (!on) setLocked(false);
    },
  };

  return (
    <AppLockContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {enabled && locked ? <LockScreen onUnlock={() => setLocked(false)} /> : null}
      </View>
    </AppLockContext.Provider>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const c = useTheme();
  const { t } = useT();
  const [error, setError] = useState(false);

  async function unlock() {
    setError(false);
    if (await confirmOwner(t('lock.prompt'))) onUnlock();
    else setError(true);
  }

  // Ask straight away; the button is there if the prompt is dismissed. Runs once per lock.
  useEffect(() => {
    let alive = true;
    confirmOwner(t('lock.prompt')).then((ok) => {
      if (!alive) return;
      if (ok) onUnlock();
      else setError(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: c.background }]}>
      <Image source={ICON} style={styles.icon} accessibilityIgnoresInvertColors />
      <T style={{ fontSize: 20, fontWeight: '700', textAlign: 'center' }}>{t('lock.locked')}</T>
      {error ? <T style={{ color: c.danger, textAlign: 'center' }}>{t('lock.failed')}</T> : null}
      <Button title={t('lock.unlock')} onPress={unlock} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const ICON = require('../../assets/images/icon.png');

const styles = StyleSheet.create({
  screen: { alignItems: 'center', justifyContent: 'center', gap: Spacing.four, padding: Spacing.six, zIndex: 10 },
  icon: { width: 96, height: 96, borderRadius: 22 },
});
