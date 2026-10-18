import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BillPaper } from '@/components/BillPaper';
import { Sheet } from '@/components/Sheet';
import { Button, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import { ACCENT_IDS, ACCENTS, BILL_THEMES, sampleBill, type AccentId, type BillThemeId } from '@/lib/billTheme';
import type { Profile } from '@/types';

/** Width the sample bill is laid out at before being scaled down into a card. */
const PAPER_WIDTH = 360;

/**
 * Pick a bill design and colour. Each card is a live, scaled-down sample bill with the owner's own
 * business details, so they see exactly what customers will get.
 */
export function BillThemePicker({
  profile,
  theme,
  accent,
  onChange,
}: {
  profile: Profile;
  theme: BillThemeId;
  accent: AccentId;
  onChange: (theme: BillThemeId, accent: AccentId) => void;
}) {
  const c = useTheme();
  const { t, lang } = useT();
  const [previewOpen, setPreviewOpen] = useState(false);
  const bill = sampleBill(profile, profile.bill_language === 'hi' ? 'hi' : lang);

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={styles.grid}>
        {BILL_THEMES.map((th) => {
          const selected = th === theme;
          return (
            <Pressable
              key={th}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(th, accent)}
              style={[styles.card, { borderColor: selected ? c.primary : c.border, backgroundColor: c.card }, selected && styles.selected]}>
              <Thumb profile={{ ...profile, bill_theme: th, bill_accent: accent }} bill={bill} />
              <T style={{ fontWeight: '700', fontSize: 14 }}>{t(`billTheme.${th}`)}</T>
              <T muted style={{ fontSize: 12 }}>{t(`billTheme.${th}.hint`)}</T>
            </Pressable>
          );
        })}
      </View>

      {theme !== 'receipt' ? (
        <View style={{ gap: Spacing.two }}>
          <T muted style={{ fontSize: 13 }}>{t('billStyle.accent')}</T>
          <View style={styles.swatches}>
            {ACCENT_IDS.map((a) => (
              <Pressable
                key={a}
                accessibilityRole="button"
                accessibilityLabel={t(`accent.${a}`)}
                accessibilityState={{ selected: a === accent }}
                onPress={() => onChange(theme, a)}
                hitSlop={6}
                style={[styles.swatch, { backgroundColor: ACCENTS[a], borderColor: a === accent ? c.text : 'transparent' }]}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Button title={t('billStyle.preview')} variant="secondary" onPress={() => setPreviewOpen(true)} />
      <Sheet visible={previewOpen} title={t('billStyle.previewTitle')} onClose={() => setPreviewOpen(false)}>
        <BillPaper bill={bill} profile={{ ...profile, bill_theme: theme, bill_accent: accent }} />
        <Button title={t('common.done')} variant="secondary" onPress={() => setPreviewOpen(false)} />
      </Sheet>
    </View>
  );
}

/** The top of a sample bill, scaled to fit the card. */
function Thumb({ profile, bill }: { profile: Profile; bill: ReturnType<typeof sampleBill> }) {
  const [width, setWidth] = useState(0);
  const scale = width / PAPER_WIDTH;
  return (
    <View style={styles.thumb} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} pointerEvents="none">
      {width > 0 ? (
        <View style={{ width: PAPER_WIDTH, transform: [{ scale }], transformOrigin: 'top left' }}>
          <BillPaper bill={bill} profile={profile} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  card: { width: '47.5%', flexGrow: 1, borderWidth: 1.5, borderRadius: 12, padding: Spacing.two, gap: 2 },
  selected: { borderWidth: 2.5 },
  thumb: { height: 150, overflow: 'hidden', borderRadius: 8, backgroundColor: '#FFFFFF', marginBottom: Spacing.one },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
});
