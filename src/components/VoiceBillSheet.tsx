import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, Chip, Field, Row, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSpeech } from '@/hooks/use-speech';
import { useTheme } from '@/hooks/use-theme';
import { LANG_NAMES } from '@/i18n';
import { useT } from '@/i18n/I18nProvider';
import { formatMoney, formatQty, lineTotal } from '@/lib/money';
import { parseVoiceBill, type VoiceLine } from '@/lib/voiceParse';
import { LANGS, type Item, type Lang } from '@/types';

/**
 * Speak (or type) several items in one go: "2 kilo chawal 60 rupaye kilo aur 1 litre doodh 56".
 * The parsed lines are shown live and only added to the bill when the user confirms.
 */
export function VoiceBillSheet({
  visible,
  items,
  currency,
  onAdd,
  onClose,
}: {
  visible: boolean;
  items: Item[];
  currency: string;
  onAdd: (lines: VoiceLine[]) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Sheet visible={visible} title={t('voice.title')} onClose={onClose}>
      <VoiceBody items={items} currency={currency} onAdd={onAdd} onClose={onClose} />
    </Sheet>
  );
}

// Separate so speech state starts fresh each time the sheet opens (Sheet only mounts children while visible).
function VoiceBody({
  items,
  currency,
  onAdd,
  onClose,
}: {
  items: Item[];
  currency: string;
  onAdd: (lines: VoiceLine[]) => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const { t, tn, unit, lang: appLang } = useT();
  const [lang, setLang] = useState<Lang>(appLang);
  const { available, listening, text, setText, error, start, stop } = useSpeech();
  const lines = parseVoiceBill(text, items);

  function add() {
    stop();
    onAdd(lines);
    onClose();
  }

  return (
    <View style={{ gap: Spacing.four }}>
      {available ? (
        <>
          <Row style={{ flexWrap: 'wrap' }}>
            {LANGS.map((l) => (
              <Chip key={l} label={LANG_NAMES[l]} selected={lang === l} onPress={() => !listening && setLang(l)} />
            ))}
          </Row>
          <View style={{ alignItems: 'center', gap: Spacing.two }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(listening ? 'voice.stop' : 'voice.start')}
              onPress={() => (listening ? stop() : start(lang, items.map((i) => i.name)))}
              style={({ pressed }) => [
                styles.mic,
                { backgroundColor: listening ? c.danger : c.primary, opacity: pressed ? 0.8 : 1 },
              ]}>
              <Ionicons name={listening ? 'stop' : 'mic'} size={34} color={c.primaryText} />
            </Pressable>
            <T muted style={{ fontSize: 13 }}>{t(listening ? 'voice.listening' : 'voice.tapToSpeak')}</T>
          </View>
        </>
      ) : null}

      <Field
        label={t(available ? 'voice.heard' : 'voice.typeLabel')}
        placeholder={t('voice.example')}
        multiline
        editable={!listening}
        value={text}
        onChangeText={setText}
        error={error ? t(error) : null}
      />
      {!available ? <T muted style={{ fontSize: 12 }}>{t('voice.noMic')}</T> : null}

      {lines.length ? (
        <View style={{ gap: Spacing.two }}>
          {lines.map((l, i) => (
            <View key={i} style={[styles.line, { borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '600' }}>{l.description || t('voice.noName')}</T>
                <T muted style={{ fontSize: 13 }}>
                  {formatQty(l.qty)}
                  {l.unit ? ` ${unit(l.unit)}` : ''}
                  {' × '}
                  {l.price_minor !== null ? formatMoney(l.price_minor, currency) : t('voice.noRate')}
                </T>
              </View>
              {l.price_minor !== null ? (
                <T style={{ fontWeight: '600' }}>{formatMoney(lineTotal(l.qty, l.price_minor), currency)}</T>
              ) : null}
            </View>
          ))}
          <T muted style={{ fontSize: 12 }}>{t('voice.reviewHint')}</T>
        </View>
      ) : null}

      <Row style={{ alignItems: 'stretch' }}>
        <Button title={t('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={onClose} />
        <Button
          title={lines.length ? tn('voice.add', lines.length) : t('voice.addNone')}
          style={{ flex: 1.4 }}
          disabled={!lines.length || listening}
          onPress={add}
        />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  mic: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
