import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProfileForm } from '@/components/ProfileForm';
import { Button, Card, Chip, Row, Screen, SectionTitle, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { completeOnboarding } from '@/db/repo';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRestore } from '@/hooks/use-restore';
import { useTheme } from '@/hooks/use-theme';
import { LANG_NAMES } from '@/i18n';
import { useT } from '@/i18n/I18nProvider';
import { formatMoney } from '@/lib/money';
import { PRESETS, presetItemName, type TradePreset } from '@/lib/presets';
import { LANGS } from '@/types';

export default function Onboarding() {
  const db = useSQLiteContext();
  const c = useTheme();
  const { t, unit, lang, setLang } = useT();
  const [preset, setPreset] = useState<TradePreset | null>(null);
  const dark = useColorScheme() === 'dark';
  // Moving to a new phone: bring everything back instead of setting up again.
  const { restore, busy } = useRestore(() => router.replace('/'));

  if (!preset) {
    return (
      <Screen contentContainerStyle={{ gap: Spacing.three }}>
        <Image
          source={dark ? LOGO_DARK : LOGO}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="Dhanzo — Bill bhejo, paisa pao"
        />
        {/* Language first, before any other text has to be read. */}
        <Row style={{ justifyContent: 'center' }}>
          {LANGS.map((l) => (
            <Chip key={l} label={LANG_NAMES[l]} selected={lang === l} onPress={() => setLang(l)} />
          ))}
        </Row>
        <T style={{ fontSize: 20, fontWeight: '700' }}>{t('onboarding.whatDoYouBill')}</T>
        <T muted>{t('onboarding.intro')}</T>
        <View style={styles.grid}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.trade}
              accessibilityRole="button"
              onPress={() => setPreset(p)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name={p.icon} size={28} color={c.primary} />
              <T style={{ fontWeight: '600' }}>{t(`trade.${p.trade}.label`)}</T>
              <T muted style={{ fontSize: 12 }}>{t(`trade.${p.trade}.hint`)}</T>
            </Pressable>
          ))}
        </View>
        <Card>
          <T muted>{t('onboarding.haveBackup')}</T>
          <Button
            title={t('backup.restore')}
            variant="secondary"
            icon={<Ionicons name="cloud-download-outline" size={18} color={c.primary} />}
            onPress={restore}
            loading={busy}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <Ionicons name={preset.icon} size={20} color={c.primary} />
            <T style={{ fontWeight: '600' }}>{t(`trade.${preset.trade}.label`)}</T>
          </Row>
          <Pressable onPress={() => setPreset(null)} hitSlop={10}>
            <T style={{ color: c.primary }}>{t('common.change')}</T>
          </Pressable>
        </Row>

        {preset.items.length ? (
          <Card>
            <SectionTitle>{t('onboarding.weWillAdd')}</SectionTitle>
            {preset.items.map((i) => (
              <Row key={i.name} style={{ justifyContent: 'space-between' }}>
                <T>{presetItemName(i, lang)}</T>
                <T muted>
                  {formatMoney(i.price_minor, '₹')} / {unit(i.unit)}
                </T>
              </Row>
            ))}
            <T muted style={{ fontSize: 12 }}>{t('onboarding.ratesHint')}</T>
          </Card>
        ) : null}

        <T muted>{t('onboarding.detailsHint')}</T>
        <ProfileForm
          // Keyed so switching trade resets the suggested prefix.
          key={preset.trade}
          initial={{ bill_prefix: preset.billPrefix }}
          submitLabel={t('onboarding.start')}
          onSubmit={async (p) => {
            await completeOnboarding(db, p, preset.trade, lang);
            router.replace('/');
          }}
        />
    </Screen>
  );
}

// The full logo with the tagline greets every new user (the app icon is too small to carry it).
const LOGO = require('../../assets/brand/dhanzo-logo.png');
const LOGO_DARK = require('../../assets/brand/dhanzo-logo-dark.png');

const styles = StyleSheet.create({
  logo: { width: '100%', maxWidth: 300, aspectRatio: 1532 / 520, alignSelf: 'center', marginTop: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  tile: {
    // Two columns: half width minus half the gap.
    width: '47.5%',
    flexGrow: 1,
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
});
