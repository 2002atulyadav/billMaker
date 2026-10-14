import { useState } from 'react';

import { Sheet } from '@/components/Sheet';
import { Button, Field, Row } from '@/components/ui';
import type { Client } from '@/types';

type ClientInput = Omit<Client, 'id'> & { id?: number };

export function ClientFormModal({
  visible,
  client,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  /** null = adding a new client */
  client: Client | null;
  onClose: () => void;
  onSave: (c: ClientInput) => Promise<void>;
  onDelete?: (id: number) => void;
}) {
  return (
    <Sheet visible={visible} title={client ? 'Edit client' : 'New client'} onClose={onClose}>
      <ClientForm client={client} onClose={onClose} onSave={onSave} onDelete={onDelete} />
    </Sheet>
  );
}

function ClientForm({
  client,
  onClose,
  onSave,
  onDelete,
}: {
  client: Client | null;
  onClose: () => void;
  onSave: (c: ClientInput) => Promise<void>;
  onDelete?: (id: number) => void;
}) {
  const [name, setName] = useState(client?.name ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [address, setAddress] = useState(client?.address ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      setError('Client name is required');
      return;
    }
    setSaving(true);
    try {
      await onSave({ id: client?.id, name: name.trim(), phone: phone.trim(), address: address.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Field
        label="Client / company name *"
        placeholder="e.g. ABC Logistics Pvt Ltd"
        value={name}
        onChangeText={setName}
        error={error}
        autoFocus={!client}
      />
      <Field label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Field label="Address (printed on bills)" multiline value={address} onChangeText={setAddress} />
      <Row>
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
      </Row>
      {client && onDelete ? <Button title="Delete client" variant="danger" onPress={() => onDelete(client.id)} /> : null}
    </>
  );
}
