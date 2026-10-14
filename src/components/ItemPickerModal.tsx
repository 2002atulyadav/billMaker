import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Field, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const [q, setQ] = useState('');
  const filtered = items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: c.card }]}>
          <T style={{ fontSize: 20, fontWeight: '700' }}>Add saved item</T>
          <Field placeholder="Search items" value={q} onChangeText={setQ} />
          <FlatList
            data={filtered}
            keyExtractor={(i) => String(i.id)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <EmptyState
                title={items.length ? 'No match' : 'No saved items'}
                message={items.length ? 'Try another search.' : 'Add your products and rates in the Items tab.'}
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
                  {formatMoney(item.price_minor, currency)} / {item.unit}
                </T>
              </Pressable>
            )}
          />
          <Button title="Done" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    height: '75%',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: Spacing.two },
});
