import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button, Chip, EmptyState, Field, Row, StatusBadge, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getUnpaidSummary, listBills, type BillFilter } from '@/db/repo';
import type { TKey } from '@/i18n';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import { formatDate, formatMoney } from '@/lib/money';
import type { Bill } from '@/types';

export default function Bills() {
  const db = useSQLiteContext();
  const c = useTheme();
  const profile = useProfile();
  const { t, tn, lang } = useT();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<BillFilter>('all');
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [unpaid, setUnpaid] = useState({ count: 0, total_minor: 0 });

  const reload = useCallback(() => {
    listBills(db, search, filter).then(setBills);
    getUnpaidSummary(db).then(setUnpaid);
  }, [db, search, filter]);
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
          <View style={{ marginBottom: Spacing.two, gap: Spacing.three }}>
            {unpaid.count > 0 ? (
              <Pressable
                onPress={() => setFilter('unpaid')}
                style={[styles.dues, { backgroundColor: c.card, borderColor: c.warning }]}>
                <T muted style={{ fontSize: 13 }}>
                  {t('bills.toCollect')} · {tn('common.bills', unpaid.count)}
                </T>
                <T style={{ fontSize: 22, fontWeight: '700', color: c.warning }}>
                  {formatMoney(unpaid.total_minor, currency)}
                </T>
              </Pressable>
            ) : null}
            <Field
              placeholder={t('bills.search')}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            <Row>
              {FILTERS.map((f) => (
                <Chip key={f.value} label={t(f.label)} selected={filter === f.value} onPress={() => setFilter(f.value)} />
              ))}
            </Row>
          </View>
        }
        ListEmptyComponent={
          bills === null ? null : search || filter !== 'all' ? (
            <EmptyState title={t('bills.noneFound')} message={t('bills.noneFoundHint')} />
          ) : (
            <EmptyState title={t('bills.empty')} message={t('bills.emptyHint')} />
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
              <T style={{ fontWeight: '600' }}>{item.customer_name || t('common.walkIn')}</T>
              <T muted style={{ fontSize: 13 }}>
                {item.bill_no} · {formatDate(item.date, lang)}
              </T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <T style={{ fontWeight: '700' }}>{formatMoney(item.total_minor, currency)}</T>
              <StatusBadge status={item.status} />
            </View>
          </Pressable>
        )}
      />
      <View style={styles.fab}>
        <Button
          title={t('bills.new')}
          icon={<Ionicons name="add" size={20} color={c.primaryText} />}
          onPress={() => router.push('/bill/new')}
        />
      </View>
    </View>
  );
}

const FILTERS = [
  { value: 'all', label: 'bills.filterAll' },
  { value: 'unpaid', label: 'bills.filterUnpaid' },
  { value: 'paid', label: 'bills.filterPaid' },
] as const satisfies readonly { value: BillFilter; label: TKey }[];

const styles = StyleSheet.create({
  dues: { padding: Spacing.four, borderRadius: 12, borderWidth: 1, gap: 2 },
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
