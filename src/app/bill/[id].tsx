import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { BillPaper } from '@/components/BillPaper';
import { PaymentSheet } from '@/components/PaymentSheet';
import { Button, Card, Row, Screen, SectionTitle, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteBill, deletePayment, getBill, markBillPaid, markBillUnpaid, markReminded } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import { daysSinceBackup as daysSince } from '@/lib/backup';
import { balanceOf, dueState } from '@/lib/due';
import { errorText } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/money';
import { shareBillImage, shareBillPdf } from '@/lib/pdf';
import { billMessage, reminderMessage, waPhone, whatsappUrl } from '@/lib/whatsapp';
import type { BillWithLines } from '@/types';

export default function BillDetail() {
  const db = useSQLiteContext();
  const c = useTheme();
  const { t, tn, lang } = useT();
  const profile = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bill, setBill] = useState<BillWithLines | null | undefined>(undefined);
  const [busy, setBusy] = useState<'pdf' | 'image' | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const paperRef = useRef<View>(null);

  const load = useCallback(() => getBill(db, Number(id)).then(setBill), [db, id]);
  useEffect(() => {
    load();
  }, [load]);

  if (bill === undefined || !profile) return null;
  if (bill === null) {
    return (
      <View style={{ padding: Spacing.five }}>
        <T>{t('bill.gone')}</T>
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
      Alert.alert(t('bill.shareFailed'), errorText(t, e));
    } finally {
      setBusy(null);
    }
  }

  const currency = profile.currency;
  const balance = balanceOf(bill);
  const due = dueState(bill);
  const remindedDays = daysSince(bill.last_reminded_at);

  async function openWhatsApp(text: string): Promise<boolean> {
    if (!phone) return false;
    try {
      await Linking.openURL(whatsappUrl(phone, text));
      return true;
    } catch {
      Alert.alert(t('bill.whatsappUnavailable'), t('bill.whatsappUnavailableHint'));
      return false;
    }
  }

  async function sendWhatsApp() {
    if (bill && profile) await openWhatsApp(billMessage(bill, profile));
  }

  async function sendReminder() {
    if (!bill || !profile) return;
    if (await openWhatsApp(reminderMessage(bill, profile))) {
      await markReminded(db, bill.id);
      load();
    }
  }

  async function markPaid() {
    if (!bill) return;
    await markBillPaid(db, bill.id);
    load();
  }

  function markUnpaid() {
    Alert.alert(t('bill.markUnpaidTitle'), t('bill.markUnpaidMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('bill.markUnpaidTitle'),
        style: 'destructive',
        onPress: async () => {
          await markBillUnpaid(db, bill!.id);
          load();
        },
      },
    ]);
  }

  function confirmDeletePayment(paymentId: number, amount: number) {
    Alert.alert(t('payment.deleteTitle'), formatMoney(amount, currency), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deletePayment(db, paymentId);
          load();
        },
      },
    ]);
  }

  const isPeriodBill = !!bill.period_start;

  function confirmDelete() {
    const msg = isPeriodBill ? tn('bill.deletePeriod', bill!.lines.length) : t('common.cannotUndo');
    Alert.alert(t('common.deleteConfirm', { name: bill!.bill_no }), msg, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteBill(db, bill!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen contentContainerStyle={{ gap: Spacing.three }}>
      <Stack.Screen options={{ title: bill.bill_no }} />

      <BillPaper ref={paperRef} bill={bill} profile={profile} />

      {due.kind !== 'none' ? (
        <T style={{ textAlign: 'center', fontWeight: '600', color: due.kind === 'due' ? c.textSecondary : c.danger }}>
          {due.kind === 'overdue'
            ? tn('due.overdue', due.days)
            : due.kind === 'today'
              ? t('due.today')
              : t('due.on', { date: formatDate(due.date, lang) })}
        </T>
      ) : null}

      {isPaid ? (
        <Button
          title={t('bill.paidToggle')}
          variant="secondary"
          icon={<Ionicons name="checkmark-circle" size={20} color={c.primary} />}
          onPress={markUnpaid}
        />
      ) : (
        <Row style={{ alignItems: 'stretch' }}>
          <Button
            title={t('bill.markPaid')}
            style={{ flex: 1 }}
            icon={<Ionicons name="checkmark-circle-outline" size={20} color={c.primaryText} />}
            onPress={markPaid}
          />
          <Button
            title={t('payment.record')}
            variant="secondary"
            style={{ flex: 1 }}
            icon={<Ionicons name="cash-outline" size={20} color={c.primary} />}
            onPress={() => setPayOpen(true)}
          />
        </Row>
      )}

      {!isPaid && phone ? (
        <>
          <Button
            title={t('bill.remind')}
            variant="secondary"
            icon={<Ionicons name="notifications-outline" size={20} color={c.primary} />}
            onPress={sendReminder}
          />
          {remindedDays !== null ? (
            <T muted style={{ fontSize: 12, textAlign: 'center', marginTop: -Spacing.two }}>
              {remindedDays === 0 ? t('bill.remindedToday') : tn('bill.remindedDays', remindedDays)}
            </T>
          ) : null}
        </>
      ) : null}

      {bill.payments.length ? (
        <Card>
          <SectionTitle>{t('payment.history')}</SectionTitle>
          {bill.payments.map((p) => (
            <Row key={p.id} style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '600' }}>{formatMoney(p.amount_minor, currency)}</T>
                <T muted style={{ fontSize: 13 }}>
                  {formatDate(p.date, lang)} · {t(`payment.method.${p.method}`)}
                  {p.reference ? ` · ${p.reference}` : ''}
                </T>
              </View>
              <Pressable
                onPress={() => confirmDeletePayment(p.id, p.amount_minor)}
                hitSlop={10}
                accessibilityLabel={t('payment.deleteTitle')}>
                <Ionicons name="trash-outline" size={20} color={c.textSecondary} />
              </Pressable>
            </Row>
          ))}
          {!isPaid ? (
            <T style={{ fontWeight: '600', color: c.warning }}>{t('payment.balance', { amount: formatMoney(balance, currency) })}</T>
          ) : null}
        </Card>
      ) : null}

      {phone ? (
        <Button
          title={t('bill.whatsapp')}
          variant="secondary"
          icon={<Ionicons name="logo-whatsapp" size={20} color={c.primary} />}
          onPress={sendWhatsApp}
        />
      ) : null}
      <Row style={{ alignItems: 'stretch' }}>
        <Button
          title={t('bill.sharePdf')}
          variant="secondary"
          style={{ flex: 1 }}
          loading={busy === 'pdf'}
          disabled={busy !== null}
          icon={<Ionicons name="document-text-outline" size={18} color={c.primary} />}
          onPress={() => run('pdf', () => shareBillPdf(bill, profile))}
        />
        <Button
          title={t('bill.shareImage')}
          variant="secondary"
          style={{ flex: 1 }}
          loading={busy === 'image'}
          disabled={busy !== null}
          icon={<Ionicons name="image-outline" size={18} color={c.primary} />}
          onPress={() => run('image', () => shareBillImage(paperRef, bill.bill_no))}
        />
      </Row>
      {!profile.upi_id && !isPaid ? (
        <T muted style={{ fontSize: 13, textAlign: 'center' }}>{t('bill.upiTip')}</T>
      ) : null}

      {bill.client_id ? (
        <Button
          title={t('bill.openClient', { name: bill.customer_name })}
          variant="secondary"
          icon={<Ionicons name="person-outline" size={18} color={c.primary} />}
          onPress={() => router.push({ pathname: '/client/[id]', params: { id: String(bill.client_id) } })}
        />
      ) : null}
      {/* Period bills come from logged work; duplicating them would double-bill those entries. */}
      {!isPeriodBill ? (
        <Button
          title={t('bill.duplicate')}
          variant="secondary"
          icon={<Ionicons name="copy-outline" size={18} color={c.primary} />}
          onPress={() => router.push({ pathname: '/bill/new', params: { from: String(bill.id) } })}
        />
      ) : null}
      <Button title={t('bill.delete')} variant="danger" onPress={confirmDelete} />

      <PaymentSheet
        visible={payOpen}
        billId={bill.id}
        balanceMinor={balance}
        currency={currency}
        onClose={() => setPayOpen(false)}
        onSaved={load}
      />
    </Screen>
  );
}
