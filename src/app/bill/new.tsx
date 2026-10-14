import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { ItemPickerModal } from '@/components/ItemPickerModal';
import { Button, Card, Chip, Field, Row, SectionTitle, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { createBill, getBill, listClients, listItems, listRecentCustomers, type RecentCustomer } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import { errorText } from '@/lib/errors';
import { isSameCustomer, suggestCustomers } from '@/lib/customers';
import {
  computeTotals,
  formatMoney,
  isValidISODate,
  lineTotal,
  minorToInput,
  parseAmount,
  parseQty,
  todayISO,
} from '@/lib/money';
import type { BillWithLines, Client, Item } from '@/types';

type DraftLine = { key: number; description: string; qty: string; unit: string; price: string };
type LineErrors = { description?: boolean; qty?: boolean; price?: boolean };

export default function NewBill() {
  const db = useSQLiteContext();
  const c = useTheme();
  const { t, unit: unitLabel } = useT();
  const profile = useProfile();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const nextKey = useRef(1);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [date, setDate] = useState(todayISO());
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [recent, setRecent] = useState<RecentCustomer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lineErrors, setLineErrors] = useState<Record<number, LineErrors>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const newLine = (l: Omit<DraftLine, 'key'>): DraftLine => ({ ...l, key: nextKey.current++ });

  useEffect(() => {
    listItems(db).then(setItems);
    listRecentCustomers(db).then(setRecent);
    listClients(db).then(setClients);
  }, [db]);

  /** Copies an existing bill's contents into the form. Date stays today; numbering is assigned on save. */
  const fillFromBill = useCallback((b: BillWithLines) => {
    setCustomerName(b.customer_name);
    setCustomerPhone(b.customer_phone);
    setDiscount(b.discount_minor ? minorToInput(b.discount_minor) : '');
    setNotes(b.notes);
    setLines(
      b.lines.map((l) => ({
        key: nextKey.current++,
        description: l.description,
        qty: String(l.qty),
        unit: l.unit,
        price: minorToInput(l.unit_price_minor),
      })),
    );
  }, []);

  // "Duplicate" opens this screen with ?from=<billId> to prefill from an existing bill.
  useEffect(() => {
    if (!from) return;
    getBill(db, Number(from)).then((b) => b && fillFromBill(b));
  }, [db, from, fillFromBill]);

  // Saved clients are suggested alongside past customers; last_bill_id 0 means no bill yet.
  const people = [
    ...recent,
    ...clients
      .filter((cl) => !recent.some((r) => isSameCustomer(r, cl.name, cl.phone)))
      .map((cl) => ({ customer_name: cl.name, customer_phone: cl.phone, last_bill_id: 0 })),
  ];
  const suggestions = suggestCustomers(people, customerName, customerPhone);
  const knownCustomer = recent.find((r) => isSameCustomer(r, customerName, customerPhone));
  const matchedClient = clients.find((cl) =>
    isSameCustomer({ customer_name: cl.name, customer_phone: cl.phone, last_bill_id: 0 }, customerName, customerPhone),
  );

  async function repeatLastBill(billId: number) {
    const b = await getBill(db, billId);
    if (b) fillFromBill(b);
  }

  const currency = profile?.currency ?? '₹';
  const parsed = lines.map((l) => ({ qty: parseQty(l.qty) ?? 0, unit_price_minor: parseAmount(l.price) ?? 0 }));
  const totals = computeTotals(parsed, parseAmount(discount) ?? 0);

  const updateLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));

  function addFromItem(item: Item) {
    setLines((ls) => {
      // Tapping the same saved item again bumps its quantity instead of adding a duplicate row.
      const existing = ls.find((l) => l.description === item.name && parseAmount(l.price) === item.price_minor);
      if (existing) {
        const q = (parseQty(existing.qty) ?? 0) + 1;
        return ls.map((l) => (l.key === existing.key ? { ...l, qty: String(q) } : l));
      }
      return [...ls, newLine({ description: item.name, qty: '1', unit: item.unit, price: minorToInput(item.price_minor) })];
    });
  }

  async function save() {
    const errs: Record<number, LineErrors> = {};
    for (const l of lines) {
      const e: LineErrors = {
        description: !l.description.trim() || undefined,
        qty: parseQty(l.qty) === null || undefined,
        price: parseAmount(l.price) === null || undefined,
      };
      if (e.description || e.qty || e.price) errs[l.key] = e;
    }
    setLineErrors(errs);

    let msg: string | null = null;
    if (lines.length === 0) msg = t('newBill.errNoItems');
    else if (Object.keys(errs).length) msg = t('newBill.errLines');
    else if (discount.trim() && parseAmount(discount) === null) msg = t('newBill.errDiscount');
    else if (!isValidISODate(date)) msg = t('newBill.errDate');
    setFormError(msg);
    if (msg) return;

    setSaving(true);
    try {
      const id = await createBill(db, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        // Linking to a saved client puts their address on the bill and includes it in their statements.
        client_id: matchedClient?.id ?? null,
        customer_address: matchedClient?.address ?? '',
        date,
        discount_minor: parseAmount(discount) ?? 0,
        notes: notes.trim(),
        lines: lines.map((l) => ({
          description: l.description.trim(),
          qty: parseQty(l.qty)!,
          unit: l.unit,
          unit_price_minor: parseAmount(l.price)!,
        })),
      });
      router.replace({ pathname: '/bill/[id]', params: { id: String(id) } });
    } catch (e) {
      Alert.alert(t('newBill.saveFailed'), errorText(t, e));
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }} keyboardShouldPersistTaps="handled">
        <Card>
          <SectionTitle>{t('newBill.customer')}</SectionTitle>
          <Field placeholder={t('newBill.customerName')} value={customerName} onChangeText={setCustomerName} />
          <Field placeholder={t('newBill.phone')} keyboardType="phone-pad" value={customerPhone} onChangeText={setCustomerPhone} />
          {suggestions.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Row>
                {suggestions.map((r) => (
                  <Chip
                    key={`${r.customer_name}|${r.customer_phone}`}
                    label={r.customer_name || r.customer_phone}
                    selected={false}
                    onPress={() => {
                      setCustomerName(r.customer_name);
                      setCustomerPhone(r.customer_phone);
                    }}
                  />
                ))}
              </Row>
            </ScrollView>
          ) : null}
          {knownCustomer && lines.length === 0 ? (
            <Button
              title={t('newBill.repeatLast')}
              variant="secondary"
              icon={<Ionicons name="repeat" size={18} color={c.primary} />}
              onPress={() => repeatLastBill(knownCustomer.last_bill_id)}
            />
          ) : null}
          <DateField label={t('newBill.date')} value={date} onChange={setDate} />
        </Card>

        <Card>
          <SectionTitle>{t('newBill.items')}</SectionTitle>
          {lines.map((l, i) => {
            const e = lineErrors[l.key] ?? {};
            const amount = lineTotal(parseQty(l.qty) ?? 0, parseAmount(l.price) ?? 0);
            return (
              <View key={l.key} style={[styles.line, { borderColor: c.border }]}>
                <Row>
                  <T muted style={{ width: 20 }}>{i + 1}.</T>
                  <View style={{ flex: 1 }}>
                    <Field
                      placeholder={t('newBill.itemPlaceholder')}
                      value={l.description}
                      onChangeText={(v) => updateLine(l.key, { description: v })}
                      error={e.description ? t('common.required') : null}
                    />
                  </View>
                  <Pressable onPress={() => removeLine(l.key)} hitSlop={10} accessibilityLabel={t('newBill.removeItem')}>
                    <Ionicons name="close-circle" size={22} color={c.textSecondary} />
                  </Pressable>
                </Row>
                <Row style={{ paddingLeft: 28, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label={`${t('newBill.qty')}${l.unit ? ` (${unitLabel(l.unit)})` : ''}`}
                      keyboardType="decimal-pad"
                      value={l.qty}
                      onChangeText={(v) => updateLine(l.key, { qty: v })}
                      error={e.qty ? t('common.invalid') : null}
                    />
                  </View>
                  <View style={{ flex: 1.3 }}>
                    <Field
                      label={t('newBill.rate', { currency })}
                      keyboardType="decimal-pad"
                      value={l.price}
                      onChangeText={(v) => updateLine(l.key, { price: v })}
                      error={e.price ? t('common.invalid') : null}
                    />
                  </View>
                </Row>
                <T style={{ textAlign: 'right', fontWeight: '600' }}>{formatMoney(amount, currency)}</T>
              </View>
            );
          })}
          <Row>
            <Button
              title={t('newBill.savedItem')}
              variant="secondary"
              style={{ flex: 1 }}
              icon={<Ionicons name="list" size={18} color={c.primary} />}
              onPress={() => setPickerOpen(true)}
            />
            <Button
              title={t('newBill.custom')}
              variant="secondary"
              style={{ flex: 1 }}
              icon={<Ionicons name="add" size={18} color={c.primary} />}
              onPress={() => setLines((ls) => [...ls, newLine({ description: '', qty: '1', unit: '', price: '' })])}
            />
          </Row>
        </Card>

        <Card>
          <Field
            label={t('newBill.discount', { currency })}
            keyboardType="decimal-pad"
            placeholder="0"
            value={discount}
            onChangeText={setDiscount}
          />
          <Field label={t('newBill.notes')} multiline placeholder={t('newBill.notesPlaceholder')} value={notes} onChangeText={setNotes} />
        </Card>

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T muted>{t('newBill.subtotal')}</T>
            <T>{formatMoney(totals.subtotal, currency)}</T>
          </Row>
          {totals.discount > 0 ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <T muted>{t('newBill.discountLabel')}</T>
              <T>-{formatMoney(totals.discount, currency)}</T>
            </Row>
          ) : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <T style={{ fontSize: 18, fontWeight: '700' }}>{t('newBill.total')}</T>
            <T style={{ fontSize: 22, fontWeight: '700' }}>{formatMoney(totals.total, currency)}</T>
          </Row>
        </Card>

        {formError ? <T style={{ color: c.danger, textAlign: 'center' }}>{formError}</T> : null}
        <Button title={t('newBill.save')} onPress={save} loading={saving} />
      </ScrollView>

      <ItemPickerModal
        visible={pickerOpen}
        items={items}
        currency={currency}
        onPick={addFromItem}
        onClose={() => setPickerOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  line: { gap: Spacing.two, paddingBottom: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
});
