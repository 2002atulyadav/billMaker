import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Row, SectionTitle, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteBill, getBill } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney } from '@/lib/money';
import { shareBillPdf } from '@/lib/pdf';
import type { BillWithLines } from '@/types';

export default function BillDetail() {
  const db = useSQLiteContext();
  const c = useTheme();
  const profile = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bill, setBill] = useState<BillWithLines | null | undefined>(undefined);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    getBill(db, Number(id)).then(setBill);
  }, [db, id]);

  if (bill === undefined || !profile) return null;
  if (bill === null) {
    return (
      <View style={{ padding: Spacing.five }}>
        <T>This bill no longer exists.</T>
      </View>
    );
  }

  const money = (m: number) => formatMoney(m, profile.currency);

  async function share() {
    if (!bill || !profile) return;
    setSharing(true);
    try {
      await shareBillPdf(bill, profile);
    } catch (e) {
      Alert.alert('Could not share bill', e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  }

  function confirmDelete() {
    Alert.alert(`Delete ${bill!.bill_no}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBill(db, bill!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
      <Stack.Screen options={{ title: bill.bill_no }} />

      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <SectionTitle>Bill to</SectionTitle>
            <T style={{ fontWeight: '600', fontSize: 17 }}>{bill.customer_name || 'Walk-in customer'}</T>
            {bill.customer_phone ? <T muted>{bill.customer_phone}</T> : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <T style={{ fontWeight: '600' }}>{bill.bill_no}</T>
            <T muted>{formatDate(bill.date)}</T>
          </View>
        </Row>
      </Card>

      <Card>
        <SectionTitle>Items</SectionTitle>
        {bill.lines.map((l, i) => (
          <View key={i} style={[styles.line, { borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '500' }}>{l.description}</T>
              <T muted style={{ fontSize: 13 }}>
                {l.qty}
                {l.unit ? ` ${l.unit}` : ''} × {money(l.unit_price_minor)}
              </T>
            </View>
            <T style={{ fontWeight: '600' }}>{money(l.line_total_minor)}</T>
          </View>
        ))}
        <Row style={{ justifyContent: 'space-between' }}>
          <T muted>Subtotal</T>
          <T>{money(bill.subtotal_minor)}</T>
        </Row>
        {bill.discount_minor > 0 ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <T muted>Discount</T>
            <T>-{money(bill.discount_minor)}</T>
          </Row>
        ) : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <T style={{ fontSize: 18, fontWeight: '700' }}>Total</T>
          <T style={{ fontSize: 22, fontWeight: '700' }}>{money(bill.total_minor)}</T>
        </Row>
      </Card>

      {bill.notes ? (
        <Card>
          <SectionTitle>Notes</SectionTitle>
          <T>{bill.notes}</T>
        </Card>
      ) : null}

      <Button
        title="Share PDF"
        loading={sharing}
        icon={<Ionicons name="share-social" size={20} color={c.primaryText} />}
        onPress={share}
      />
      <Button
        title="Duplicate as new bill"
        variant="secondary"
        icon={<Ionicons name="copy-outline" size={18} color={c.primary} />}
        onPress={() => router.push({ pathname: '/bill/new', params: { from: String(bill.id) } })}
      />
      <Button title="Delete bill" variant="danger" onPress={confirmDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
