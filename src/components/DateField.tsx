import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Row, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import { formatDate, isoToDate, todayISO } from '@/lib/money';

/** Date input backed by the native picker. Value is a local "YYYY-MM-DD" string. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const { t, lang } = useT();
  const date = isoToDate(value);

  if (Platform.OS !== 'android') {
    // iOS renders the compact picker inline: a tappable date pill that opens a calendar popover.
    return (
      <Row style={{ justifyContent: 'space-between' }}>
        <T muted style={styles.label}>{label}</T>
        <DateTimePicker
          value={date}
          mode="date"
          display="compact"
          locale={lang === 'hi' ? 'hi_IN' : 'en_IN'}
          accentColor={c.primary}
          onValueChange={(_e, d) => onChange(todayISO(d))}
        />
      </Row>
    );
  }

  // Android has no inline compact picker; show the date and open the Material dialog on tap.
  return (
    <View style={{ gap: Spacing.one }}>
      <T muted style={styles.label}>{label}</T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('date.tapToChange', { label, date: formatDate(value, lang) })}
        onPress={() => setOpen(true)}
        style={[styles.input, { backgroundColor: c.background, borderColor: c.border }]}>
        <T>{formatDate(value, lang)}</T>
        <Ionicons name="calendar-outline" size={18} color={c.textSecondary} />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={date}
          mode="date"
          presentation="dialog"
          accentColor={c.primary}
          onValueChange={(_e, d) => {
            setOpen(false);
            onChange(todayISO(d));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13 },
  input: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
});
