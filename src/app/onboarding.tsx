import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProfileForm } from '@/components/ProfileForm';
import { Card, Chip, Row, SectionTitle, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { completeOnboarding } from '@/db/repo';
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

  if (!preset) {
    return (
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
        {/* Language first, before any other text has to be read. */}
        <Row style={{ justifyContent: 'flex-end' }}>
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
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }} keyboardShouldPersistTaps="handled">
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
