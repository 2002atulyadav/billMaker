import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Field, Row, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { minorToInput, parseAmount } from '@/lib/money';
import { UNITS, type Item, type Unit } from '@/types';

type SaveFn = (v: { id?: number; name: string; price_minor: number; unit: Unit }) => Promise<void>;

export function ItemFormModal({
  visible,
  item,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  /** null = creating a new item */
  item: Item | null;
  onClose: () => void;
  onSave: SaveFn;
  onDelete?: (id: number) => void;
}) {
  const c = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: c.card }]}>
          {/* Keyed so each open starts with fresh state from `item`. */}
          {visible ? (
            <ItemForm key={item?.id ?? 'new'} item={item} onClose={onClose} onSave={onSave} onDelete={onDelete} />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ItemForm({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: Item | null;
  onClose: () => void;
  onSave: SaveFn;
  onDelete?: (id: number) => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item ? minorToInput(item.price_minor) : '');
  const [unit, setUnit] = useState<Unit>(item?.unit ?? 'pcs');
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});

  async function save() {
    const price_minor = parseAmount(price);
    const next = {
      name: name.trim() ? undefined : 'Name is required',
      price: price_minor === null ? 'Enter a valid price, e.g. 120 or 15.50' : undefined,
    };
    setErrors(next);
    if (next.name || next.price || price_minor === null) return;
    await onSave({ id: item?.id, name: name.trim(), price_minor, unit });
  }

  return (
    <ScrollView contentContainerStyle={{ gap: Spacing.four }} keyboardShouldPersistTaps="handled">
      <T style={{ fontSize: 20, fontWeight: '700' }}>{item ? 'Edit item' : 'New item'}</T>
      <Field
        label="Name"
        placeholder="e.g. Per km fare, Rice 1kg, Haircut"
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoFocus={!item}
      />
      <Field
        label="Price"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
        error={errors.price}
      />
      <View style={{ gap: Spacing.two }}>
        <T muted style={{ fontSize: 13 }}>Unit</T>
        <Row style={{ flexWrap: 'wrap' }}>
          {UNITS.map((u) => (
            <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} />
          ))}
        </Row>
      </View>
      <Row>
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Save" onPress={save} style={{ flex: 1 }} />
      </Row>
      {item && onDelete ? <Button title="Delete item" variant="danger" onPress={() => onDelete(item.id)} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.five,
    paddingBottom: Spacing.six,
    maxHeight: '90%',
  },
});
