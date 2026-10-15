import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Sheet } from '@/components/Sheet';
import { Button, Chip, Field, Row, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { EntryInput } from '@/db/repo';
import { useT } from '@/i18n/I18nProvider';
import { errorText } from '@/lib/errors';
import { cleanDetails } from '@/lib/entries';
import { formatMoney, lineTotal, minorToInput, parseAmount, parseQty, todayISO } from '@/lib/money';
import type { DetailField, Details, Entry, Item, Unit } from '@/types';

type Props = {
  visible: boolean;
  clientId: number;
  /** null = logging new work */
  entry: Entry | null;
  items: Item[];
  units: Unit[];
  /** trade-specific fields, e.g. From / To / Vehicle no. for transport */
  fields: DetailField[];
  currency: string;
  onClose: () => void;
  /** keepOpen is true for "Save & add another" */
  onSave: (e: EntryInput, keepOpen: boolean) => Promise<void>;
  onDelete?: (id: number) => void;
};

export function EntryFormModal(props: Props) {
  const { t } = useT();
  return (
    <Sheet visible={props.visible} title={t(props.entry ? 'entry.edit' : 'entry.add')} onClose={props.onClose}>
      <EntryForm {...props} />
    </Sheet>
  );
}

function EntryForm({ clientId, entry, items, units, fields, currency, onClose, onSave, onDelete }: Props) {
  const [date, setDate] = useState(entry?.date ?? todayISO());
  const [description, setDescription] = useState(entry?.description ?? '');
  const [qty, setQty] = useState(entry ? String(entry.qty) : '1');
  const [unit, setUnit] = useState(entry?.unit ?? units[0] ?? '');
  const [price, setPrice] = useState(entry ? minorToInput(entry.unit_price_minor) : '');
  const [details, setDetails] = useState<Details>(entry?.details ?? {});
  const [errors, setErrors] = useState<{ description?: string; qty?: string; price?: string }>({});
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const { t, tn, unit: unitLabel } = useT();

  const amount = lineTotal(parseQty(qty) ?? 0, parseAmount(price) ?? 0);
  // Keep the entry's own unit visible even if the trade no longer offers it.
  const unitChips = unit && !units.includes(unit as Unit) ? [...units, unit] : units;

  function pickItem(item: Item) {
    setDescription(item.name);
    setUnit(item.unit);
    setPrice(minorToInput(item.price_minor));
  }

  async function save(addAnother: boolean) {
    const q = parseQty(qty);
    const p = parseAmount(price);
    const next = {
      description: description.trim() ? undefined : t('entry.workRequired'),
      qty: q === null ? t('common.invalid') : undefined,
      price: p === null ? t('common.invalid') : undefined,
    };
    setErrors(next);
    if (next.description || q === null || p === null) return;

    setSaving(true);
    try {
      await onSave({
        id: entry?.id,
        client_id: clientId,
        date,
        description: description.trim(),
        qty: q,
        unit,
        unit_price_minor: p,
        details: cleanDetails(fields, details),
      }, addAnother);
      // Only reset for the next entry once this one is safely stored.
      if (addAnother) {
        // Same day, same kind of work is the common case (several trips in a day); only the trade fields change.
        setDetails({});
        setSavedCount((n) => n + 1);
      }
    } catch (err) {
      Alert.alert(t('entry.saveFailed'), errorText(t, err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DateField label={t('newBill.date')} value={date} onChange={setDate} />

      {items.length && !entry ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Row>
            {items.map((i) => (
              <Chip key={i.id} label={i.name} selected={description === i.name} onPress={() => pickItem(i)} />
            ))}
          </Row>
        </ScrollView>
      ) : null}

      <Field
        label={t('entry.work')}
        placeholder={t('entry.workPlaceholder')}
        value={description}
        onChangeText={setDescription}
        error={errors.description}
      />

      {fields.map((f) => (
        <Field
          key={f.key}
          label={f.label}
          placeholder={f.placeholder}
          value={details[f.key] ?? ''}
          onChangeText={(v) => setDetails((d) => ({ ...d, [f.key]: v }))}
          autoCapitalize={f.key === 'vehicle' ? 'characters' : 'words'}
        />
      ))}

      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field label={t('newBill.qty')} keyboardType="decimal-pad" value={qty} onChangeText={setQty} error={errors.qty} />
        </View>
        <View style={{ flex: 1.3 }}>
          <Field
            label={t('newBill.rate', { currency })}
            keyboardType="decimal-pad"
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            error={errors.price}
          />
        </View>
      </Row>
      <Row style={{ flexWrap: 'wrap' }}>
        {unitChips.map((u) => (
          <Chip key={u} label={unitLabel(u)} selected={unit === u} onPress={() => setUnit(u)} />
        ))}
      </Row>

      <T style={{ fontWeight: '700', fontSize: 18, textAlign: 'right' }}>{formatMoney(amount, currency)}</T>
      {savedCount > 0 ? (
        <T muted style={{ textAlign: 'center', fontSize: 13 }}>
          {tn('entry.savedCount', savedCount)}
        </T>
      ) : null}

      <Row style={{ gap: Spacing.two, alignItems: 'stretch' }}>
        <Button title={t(savedCount ? 'common.done' : 'common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title={t('common.save')} onPress={() => save(false)} loading={saving} style={{ flex: 1 }} />
      </Row>
      {!entry ? <Button title={t('entry.saveAnother')} variant="secondary" onPress={() => save(true)} /> : null}
      {entry && onDelete ? <Button title={t('entry.delete')} variant="danger" onPress={() => onDelete(entry.id)} /> : null}
    </>
  );
}
