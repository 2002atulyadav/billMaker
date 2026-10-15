import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { sheetStyles, useSheetPadding } from '@/components/Sheet';
import { Button, EmptyState, Field, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import { formatMoney } from '@/lib/money';
import type { Item } from '@/types';

export function ItemPickerModal({
  visible,
  items,
  currency,
  onPick,
  onClose,
}: {
  visible: boolean;
  items: Item[];
  currency: string;
  onPick: (item: Item) => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const { t, unit } = useT();
  const [q, setQ] = useState('');
  const pad = useSheetPadding();
  const filtered = items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Moves up with the keyboard so the search results and Done stay visible while typing */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={sheetStyles.backdrop}>
        <View style={[sheetStyles.sheet, styles.picker, pad, { backgroundColor: c.card }]}>
          <T style={{ fontSize: 20, fontWeight: '700' }}>{t('items.pickTitle')}</T>
          <Field placeholder={t('items.search')} value={q} onChangeText={setQ} />
          <FlatList
            data={filtered}
            keyExtractor={(i) => String(i.id)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <EmptyState
                title={t(items.length ? 'items.noMatch' : 'items.noneSaved')}
                message={t(items.length ? 'items.noMatchHint' : 'items.noneSavedHint')}
              />
            }
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onPick(item);
                  setQ('');
                }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
                <T style={{ flex: 1, fontWeight: '500' }}>{item.name}</T>
                <T muted>
                  {formatMoney(item.price_minor, currency)} / {unit(item.unit)}
                </T>
              </Pressable>
            )}
          />
          <Button title={t('common.done')} variant="secondary" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // A fixed height so the sheet doesn't jump as the search narrows the list
  picker: { gap: Spacing.three, height: '75%' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: Spacing.two },
});
