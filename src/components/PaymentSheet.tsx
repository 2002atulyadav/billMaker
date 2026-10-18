import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { DateField } from '@/components/DateField';
import { Sheet } from '@/components/Sheet';
import { Button, Chip, Field, Row, T } from '@/components/ui';
import { recordPayment } from '@/db/repo';
import { useT } from '@/i18n/I18nProvider';
import { errorText } from '@/lib/errors';
import { formatMoney, isValidISODate, minorToInput, parseAmount, todayISO } from '@/lib/money';
import { PAYMENT_METHODS, type PaymentMethod } from '@/types';

/** Records money received against a bill, in full or in part. */
export function PaymentSheet({
  visible,
  billId,
  balanceMinor,
  currency,
  onClose,
  onSaved,
}: {
  visible: boolean;
  billId: number;
  balanceMinor: number;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  return (
    <Sheet visible={visible} title={t('payment.title')} onClose={onClose}>
      <PaymentForm billId={billId} balanceMinor={balanceMinor} currency={currency} onClose={onClose} onSaved={onSaved} />
    </Sheet>
  );
}

function PaymentForm({
  billId,
  balanceMinor,
  currency,
  onClose,
  onSaved,
}: {
  billId: number;
  balanceMinor: number;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const db = useSQLiteContext();
  const { t } = useT();
  const [amount, setAmount] = useState(minorToInput(balanceMinor));
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const minor = parseAmount(amount);
    if (minor === null || minor <= 0) return setError(t('payment.amountInvalid'));
    if (minor > balanceMinor) return setError(t('payment.tooMuch'));
    if (!isValidISODate(date)) return setError(t('newBill.errDate'));
    setSaving(true);
    try {
      await recordPayment(db, billId, { amount_minor: minor, date, method, reference, note: '' });
      onSaved();
      onClose();
    } catch (e) {
      setError(errorText(t, e));
      setSaving(false);
    }
  }

  return (
    <>
      <Field
        label={t('payment.amount', { currency })}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          setError(null);
        }}
        error={error}
      />
      <T muted style={{ fontSize: 12 }}>{t('payment.balanceHint', { amount: formatMoney(balanceMinor, currency) })}</T>
      <DateField label={t('payment.date')} value={date} onChange={setDate} />
      <T muted style={{ fontSize: 13 }}>{t('payment.method')}</T>
      <Row style={{ flexWrap: 'wrap' }}>
        {PAYMENT_METHODS.map((m) => (
          <Chip key={m} label={t(`payment.method.${m}`)} selected={method === m} onPress={() => setMethod(m)} />
        ))}
      </Row>
      <Field
        label={t('payment.reference')}
        placeholder={t('payment.referencePlaceholder')}
        autoCapitalize="characters"
        value={reference}
        onChangeText={setReference}
        maxLength={40}
      />
      <Row style={{ alignItems: 'stretch' }}>
        <Button title={t('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={onClose} />
        <Button title={t('payment.save')} style={{ flex: 1.4 }} onPress={save} loading={saving} />
      </Row>
    </>
  );
}
