import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ItemFormModal } from '@/components/ItemFormModal';
import { Button, EmptyState, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteItem, listItems, saveItem } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import type { Item } from '@/types';

export default function Items() {
  const db = useSQLiteContext();
  const c = useTheme();
  const profile = useProfile();
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
    Alert.alert('Delete item?', 'Bills already created will not change.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
        contentContainerStyle={{ padding: Spacing.four, gap: Spacing.two, paddingBottom: 120 }}
        ListEmptyComponent={
          <EmptyState
            title="No saved items yet"
            message="Save the things you charge for — products, per-km fare, waiting charge — so adding them to a bill takes one tap."
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
              <T muted> / {item.unit}</T>
            </T>
            <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
          </Pressable>
        )}
      />
      <View style={styles.fab}>
        <Button
          title="Add item"
          icon={<Ionicons name="add" size={20} color={c.primaryText} />}
          onPress={() => open(null)}
        />
      </View>
      <ItemFormModal
        visible={formOpen}
        item={editing}
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
  fab: { position: 'absolute', left: Spacing.four, right: Spacing.four, bottom: Spacing.four },
});
