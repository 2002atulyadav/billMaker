import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { BillPaper } from '@/components/BillPaper';
import { Button, Row, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteBill, getBill, setBillStatus } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { shareBillImage, shareBillPdf } from '@/lib/pdf';
import { billMessage, waPhone, whatsappUrl } from '@/lib/whatsapp';
import type { BillWithLines } from '@/types';

export default function BillDetail() {
  const db = useSQLiteContext();
  const c = useTheme();
  const profile = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bill, setBill] = useState<BillWithLines | null | undefined>(undefined);
  const [busy, setBusy] = useState<'pdf' | 'image' | null>(null);
  const paperRef = useRef<View>(null);

  const load = useCallback(() => getBill(db, Number(id)).then(setBill), [db, id]);
  useEffect(() => {
    load();
  }, [load]);

  if (bill === undefined || !profile) return null;
  if (bill === null) {
    return (
      <View style={{ padding: Spacing.five }}>
        <T>This bill no longer exists.</T>
      </View>
    );
  }

  const phone = waPhone(bill.customer_phone);
  const isPaid = bill.status === 'paid';

  async function run(kind: 'pdf' | 'image', fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Could not share bill', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function sendWhatsApp() {
    if (!bill || !profile || !phone) return;
    try {
      await Linking.openURL(whatsappUrl(phone, billMessage(bill, profile)));
    } catch {
      Alert.alert('WhatsApp not available', 'Use “Share PDF” or “Share image” to send the bill another way.');
    }
  }

  async function togglePaid() {
    if (!bill) return;
    await setBillStatus(db, bill.id, isPaid ? 'unpaid' : 'paid');
    load();
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
    <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
      <Stack.Screen options={{ title: bill.bill_no }} />

      <BillPaper ref={paperRef} bill={bill} profile={profile} />

      <Button
        title={isPaid ? 'Paid · tap to mark unpaid' : 'Mark as paid'}
        variant={isPaid ? 'secondary' : 'primary'}
        icon={
          <Ionicons
            name={isPaid ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={20}
            color={isPaid ? c.primary : c.primaryText}
          />
        }
        onPress={togglePaid}
      />

      {phone ? (
        <Button
          title="Send on WhatsApp"
          variant="secondary"
          icon={<Ionicons name="logo-whatsapp" size={20} color={c.primary} />}
          onPress={sendWhatsApp}
        />
      ) : null}
      <Row>
        <Button
          title="Share PDF"
          variant="secondary"
          style={{ flex: 1 }}
          loading={busy === 'pdf'}
          disabled={busy !== null}
          icon={<Ionicons name="document-text-outline" size={18} color={c.primary} />}
          onPress={() => run('pdf', () => shareBillPdf(bill, profile))}
        />
        <Button
          title="Share image"
          variant="secondary"
          style={{ flex: 1 }}
          loading={busy === 'image'}
          disabled={busy !== null}
          icon={<Ionicons name="image-outline" size={18} color={c.primary} />}
          onPress={() => run('image', () => shareBillImage(paperRef, bill.bill_no))}
        />
      </Row>
      {!profile.upi_id && !isPaid ? (
        <T muted style={{ fontSize: 13, textAlign: 'center' }}>
          Tip: add your UPI ID in Settings to print a “Scan to pay” QR on every bill.
        </T>
      ) : null}

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
