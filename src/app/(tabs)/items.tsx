import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ItemFormModal } from '@/components/ItemFormModal';
import { Button, EmptyState, Fab, FAB_CLEARANCE, screenContent, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteItem, listItems, saveItem } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import { formatMoney } from '@/lib/money';
import { unitsFor } from '@/lib/presets';
import type { Item } from '@/types';

export default function Items() {
  const db = useSQLiteContext();
  const c = useTheme();
  const profile = useProfile();
  const { t, unit } = useT();
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(() => listItems(db).then(setItems), [db]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const open = (item: Item | null) => {
    setEditing(item);
    setFormOpen(true);
  };

  const confirmDelete = (id: number) =>
    Alert.alert(t('items.deleteTitle'), t('items.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteItem(db, id);
          setFormOpen(false);
          reload();
        },
      },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={[screenContent, { gap: Spacing.two, paddingBottom: FAB_CLEARANCE }]}
        ListEmptyComponent={
          <EmptyState
            title={t('items.empty')}
            message={t('items.emptyHint')}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <T style={{ flex: 1, fontWeight: '500' }}>{item.name}</T>
            <T>
              {formatMoney(item.price_minor, profile?.currency ?? '₹')}
              <T muted> / {unit(item.unit)}</T>
            </T>
            <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
          </Pressable>
        )}
      />
      <Fab>
        <Button
          title={t('items.add')}
          icon={<Ionicons name="add" size={20} color={c.primaryText} />}
          onPress={() => open(null)}
        />
      </Fab>
      <ItemFormModal
        visible={formOpen}
        item={editing}
        units={unitsFor(profile?.trade ?? 'general', editing?.unit)}
        onClose={() => setFormOpen(false)}
        onDelete={confirmDelete}
        onSave={async (v) => {
          await saveItem(db, v);
          setFormOpen(false);
          reload();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
