import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Field, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listBills } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney } from '@/lib/money';
import type { Bill } from '@/types';

export default function Bills() {
  const db = useSQLiteContext();
  const c = useTheme();
  const profile = useProfile();
  const [search, setSearch] = useState('');
  const [bills, setBills] = useState<Bill[] | null>(null);

  const reload = useCallback(() => listBills(db, search).then(setBills), [db, search]);
  // useFocusEffect re-runs whenever `reload` changes, so this also covers typing in the search box.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const currency = profile?.currency ?? '₹';

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={bills ?? []}
        keyExtractor={(b) => String(b.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: Spacing.four, gap: Spacing.two, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ marginBottom: Spacing.two }}>
            <Field
              placeholder="Search by customer, phone or bill no."
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>
        }
        ListEmptyComponent={
          bills === null ? null : search ? (
            <EmptyState title="No bills found" message="Try a different search." />
          ) : (
            <EmptyState title="No bills yet" message="Tap “New bill” to create your first bill and share it as a PDF." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/bill/[id]', params: { id: String(item.id) } })}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontWeight: '600' }}>{item.customer_name || 'Walk-in customer'}</T>
              <T muted style={{ fontSize: 13 }}>
                {item.bill_no} · {formatDate(item.date)}
              </T>
            </View>
            <T style={{ fontWeight: '700' }}>{formatMoney(item.total_minor, currency)}</T>
          </Pressable>
        )}
      />
      <View style={styles.fab}>
        <Button
          title="New bill"
          icon={<Ionicons name="add" size={20} color={c.primaryText} />}
          onPress={() => router.push('/bill/new')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fab: { position: 'absolute', left: Spacing.four, right: Spacing.four, bottom: Spacing.four },
});
