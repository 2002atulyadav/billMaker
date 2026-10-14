import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Sheet } from '@/components/Sheet';
import { Button, Chip, Field, Row, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { EntryInput } from '@/db/repo';
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
  return (
    <Sheet visible={props.visible} title={props.entry ? 'Edit entry' : 'Add entry'} onClose={props.onClose}>
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
      description: description.trim() ? undefined : 'What was the work?',
      qty: q === null ? 'Invalid' : undefined,
      price: p === null ? 'Invalid' : undefined,
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
      Alert.alert('Could not save entry', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DateField label="Date" value={date} onChange={setDate} />

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
        label="Work / item"
        placeholder="e.g. Trip charge"
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
          <Field label="Qty" keyboardType="decimal-pad" value={qty} onChangeText={setQty} error={errors.qty} />
        </View>
        <View style={{ flex: 1.3 }}>
          <Field
            label={`Rate (${currency})`}
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
          <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} />
        ))}
      </Row>

      <T style={{ fontWeight: '700', fontSize: 18, textAlign: 'right' }}>{formatMoney(amount, currency)}</T>
      {savedCount > 0 ? (
        <T muted style={{ textAlign: 'center', fontSize: 13 }}>
          {savedCount} {savedCount === 1 ? 'entry' : 'entries'} saved. Add the next one.
        </T>
      ) : null}

      <Row style={{ gap: Spacing.two }}>
        <Button title={savedCount ? 'Done' : 'Cancel'} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Save" onPress={() => save(false)} loading={saving} style={{ flex: 1 }} />
      </Row>
      {!entry ? <Button title="Save & add another" variant="secondary" onPress={() => save(true)} /> : null}
      {entry && onDelete ? <Button title="Delete entry" variant="danger" onPress={() => onDelete(entry.id)} /> : null}
    </>
  );
}
