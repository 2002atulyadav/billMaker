import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ClientFormModal } from '@/components/ClientFormModal';
import { EntryFormModal } from '@/components/EntryFormModal';
import { PeriodModal } from '@/components/PeriodModal';
import { Button, Card, Chip, EmptyState, Row, SectionTitle, StatusBadge, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  createPeriodBill,
  deleteClient,
  deleteEntry,
  getClient,
  listClientBills,
  listEntries,
  listItems,
  saveClient,
  saveEntry,
} from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import { errorText } from '@/lib/errors';
import { detailsText, entryTotal, groupByMonth, sumEntries } from '@/lib/entries';
import { formatDate, formatMoney, formatQty, isoToDate, todayISO } from '@/lib/money';
import { shareStatementPdf } from '@/lib/pdf';
import { formatPeriod, monthPeriod, type Period } from '@/lib/period';
import { presetFor, unitsFor } from '@/lib/presets';
import type { Bill, Client, Entry, Item } from '@/types';

const ALL_TIME: Period = { start: '0000-01-01', end: '9999-12-31' };

export default function ClientDetail() {
  const db = useSQLiteContext();
  const c = useTheme();
  const { t, tn, lang, unit, dyn } = useT();
  const profile = useProfile();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);

  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [showBilled, setShowBilled] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [periodMode, setPeriodMode] = useState<'bill' | 'statement' | null>(null);

  const load = useCallback(async () => {
    const [cl, es, bs, its] = await Promise.all([
      getClient(db, clientId),
      listEntries(db, clientId),
      listClientBills(db, clientId, ALL_TIME),
      listItems(db),
    ]);
    setClient(cl);
    setEntries(es);
    setBills(bs.reverse());
    setItems(its);
  }, [db, clientId]);

  // Reload on focus so marking a bill paid (or deleting it) is reflected when coming back.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (client === undefined || !profile) return null;
  if (client === null) {
    return (
      <View style={{ padding: Spacing.five }}>
        <T>{t('client.gone')}</T>
      </View>
    );
  }

  const currency = profile.currency;
  const money = (m: number) => formatMoney(m, currency);
  // Field labels in the app language; bills snapshot the English labels and translate when printing.
  const fields = presetFor(profile.trade).entryFields.map((f) => ({
    ...f,
    label: dyn(`field.${f.key}`, f.label),
    placeholder: f.placeholder && dyn(`field.${f.key}.placeholder`, f.placeholder),
  }));
  const unbilled = entries.filter((e) => e.bill_id === null);
  const unbilledSum = sumEntries(unbilled);
  const groups = groupByMonth(showBilled ? entries : unbilled);
  const outstanding = bills.filter((b) => b.status === 'unpaid').reduce((s, b) => s + b.total_minor, 0);

  function openEntry(e: Entry | null) {
    setEditingEntry(e);
    setEntryOpen(true);
  }

  function confirmDeleteEntry(entryId: number) {
    Alert.alert(t('entry.deleteTitle'), t('common.cannotUndo'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEntry(db, entryId);
            setEntryOpen(false);
            load();
          } catch (err) {
            Alert.alert(t('entry.deleteFailed'), errorText(t, err));
          }
        },
      },
    ]);
  }

  function confirmDeleteClient(cid: number) {
    Alert.alert(
      t('common.deleteConfirm', { name: client!.name }),
      unbilled.length ? tn('clients.deleteWithEntries', unbilled.length) : t('clients.deleteKeepsBills'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteClient(db, cid);
            setClientOpen(false);
            router.back();
          },
        },
      ],
    );
  }

  async function confirmPeriod(period: Period) {
    try {
      if (periodMode === 'bill') {
        const billId = await createPeriodBill(db, clientId, period, todayISO());
        setPeriodMode(null);
        router.push({ pathname: '/bill/[id]', params: { id: String(billId) } });
      } else {
        await shareStatementPdf({
          profile: profile!,
          client: client!,
          period,
          bills: await listClientBills(db, clientId, period),
          unbilled: unbilledSum,
        });
        setPeriodMode(null);
      }
    } catch (err) {
      Alert.alert(
        t(periodMode === 'bill' ? 'client.billFailed' : 'client.statementFailed'),
        errorText(t, err),
      );
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: client.name,
          headerRight: () => (
            <Pressable onPress={() => setClientOpen(true)} hitSlop={10} accessibilityLabel={t('clients.edit')}>
              <T style={{ color: c.primary }}>{t('common.edit')}</T>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four, paddingBottom: 120 }}>
        <Card>
          {client.phone ? <T muted>{client.phone}</T> : null}
          {client.address ? <T muted>{client.address}</T> : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <SectionTitle>{t('client.unbilledWork')}</SectionTitle>
              <T style={{ fontSize: 22, fontWeight: '700' }}>{money(unbilledSum.total_minor)}</T>
              <T muted style={{ fontSize: 13 }}>
                {tn('common.entries', unbilledSum.count)}
              </T>
            </View>
            {outstanding > 0 ? (
              <View style={{ alignItems: 'flex-end' }}>
                <SectionTitle>{t('client.billsUnpaid')}</SectionTitle>
                <T style={{ fontSize: 18, fontWeight: '700', color: c.warning }}>{money(outstanding)}</T>
              </View>
            ) : null}
          </Row>
          <Row>
            <Button
              title={t('client.createBill')}
              style={{ flex: 1 }}
              disabled={unbilled.length === 0}
              icon={<Ionicons name="receipt-outline" size={18} color={c.primaryText} />}
              onPress={() => setPeriodMode('bill')}
            />
            <Button
              title={t('client.statement')}
              variant="secondary"
              style={{ flex: 1 }}
              icon={<Ionicons name="document-text-outline" size={18} color={c.primary} />}
              onPress={() => setPeriodMode('statement')}
            />
          </Row>
        </Card>

        <Row style={{ justifyContent: 'space-between' }}>
          <SectionTitle>{t('client.workLog')}</SectionTitle>
          <Row>
            <Chip label={t('client.filterUnbilled')} selected={!showBilled} onPress={() => setShowBilled(false)} />
            <Chip label={t('client.filterAll')} selected={showBilled} onPress={() => setShowBilled(true)} />
          </Row>
        </Row>

        {groups.length === 0 ? (
          <EmptyState
            title={t(showBilled ? 'client.noWork' : 'client.nothingToBill')}
            message={t('client.workHint')}
          />
        ) : null}

        {groups.map((g) => (
          <View key={g.key} style={{ gap: Spacing.two }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={{ fontWeight: '600' }}>{formatPeriod(monthPeriod(isoToDate(`${g.key}-01`)), lang)}</T>
              {g.unbilled_minor ? <T muted>{t('client.monthUnbilled', { amount: money(g.unbilled_minor) })}</T> : null}
            </Row>
            {g.entries.map((e) => {
              const extra = detailsText(fields, e.details);
              const billed = e.bill_id !== null;
              return (
                <Pressable
                  key={e.id}
                  onPress={() =>
                    billed
                      ? router.push({ pathname: '/bill/[id]', params: { id: String(e.bill_id) } })
                      : openEntry(e)
                  }
                  style={({ pressed }) => [
                    styles.entry,
                    { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : billed ? 0.6 : 1 },
                  ]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T muted style={{ fontSize: 12 }}>
                      {formatDate(e.date, lang)}
                      {billed ? ` · ${t('client.billedOn', { billNo: e.bill_no ?? '' })}` : ''}
                    </T>
                    <T style={{ fontWeight: '500' }}>{e.description}</T>
                    {extra ? <T muted style={{ fontSize: 13 }}>{extra}</T> : null}
                    <T muted style={{ fontSize: 13 }}>
                      {formatQty(e.qty)}
                      {e.unit ? ` ${unit(e.unit)}` : ''} × {money(e.unit_price_minor)}
                    </T>
                  </View>
                  <T style={{ fontWeight: '600' }}>{money(entryTotal(e))}</T>
                </Pressable>
              );
            })}
          </View>
        ))}

        {bills.length ? (
          <View style={{ gap: Spacing.two }}>
            <SectionTitle>{t('client.bills')}</SectionTitle>
            {bills.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => router.push({ pathname: '/bill/[id]', params: { id: String(b.id) } })}
                style={({ pressed }) => [
                  styles.entry,
                  { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={{ fontWeight: '600' }}>{b.bill_no}</T>
                  <T muted style={{ fontSize: 13 }}>
                    {b.period_start && b.period_end
                      ? formatPeriod({ start: b.period_start, end: b.period_end }, lang)
                      : formatDate(b.date, lang)}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <T style={{ fontWeight: '700' }}>{money(b.total_minor)}</T>
                  <StatusBadge status={b.status} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.fab}>
        <Button
          title={t('client.addEntry')}
          icon={<Ionicons name="add" size={20} color={c.primaryText} />}
          onPress={() => openEntry(null)}
        />
      </View>

      <EntryFormModal
        visible={entryOpen}
        clientId={clientId}
        entry={editingEntry}
        items={items}
        units={unitsFor(profile.trade)}
        fields={fields}
        currency={currency}
        onClose={() => {
          setEntryOpen(false);
          load();
        }}
        onDelete={confirmDeleteEntry}
        onSave={async (e, keepOpen) => {
          await saveEntry(db, e);
          if (!keepOpen) setEntryOpen(false);
          load();
        }}
      />
      <ClientFormModal
        visible={clientOpen}
        client={client}
        onClose={() => setClientOpen(false)}
        onDelete={confirmDeleteClient}
        onSave={async (cl) => {
          await saveClient(db, cl);
          setClientOpen(false);
          load();
        }}
      />
      <PeriodModal
        visible={periodMode !== null}
        mode={periodMode ?? 'bill'}
        entries={entries}
        currency={currency}
        onClose={() => setPeriodMode(null)}
        onConfirm={confirmPeriod}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fab: { position: 'absolute', left: Spacing.four, right: Spacing.four, bottom: Spacing.four },
});
