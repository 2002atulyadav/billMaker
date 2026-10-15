import { useState } from 'react';

import { Sheet } from '@/components/Sheet';
import { Button, Field, Row } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
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
  const { t } = useT();
  return (
    <Sheet visible={visible} title={t(client ? 'clients.edit' : 'clients.new')} onClose={onClose}>
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
  const { t } = useT();

  async function save() {
    if (!name.trim()) {
      setError(t('clients.nameRequired'));
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
        label={t('clients.name')}
        placeholder={t('clients.namePlaceholder')}
        value={name}
        onChangeText={setName}
        error={error}
        autoFocus={!client}
      />
      <Field label={t('profile.phone')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Field label={t('clients.address')} multiline value={address} onChangeText={setAddress} />
      <Row style={{ alignItems: 'stretch' }}>
        <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title={t('common.save')} onPress={save} loading={saving} style={{ flex: 1 }} />
      </Row>
      {client && onDelete ? <Button title={t('clients.delete')} variant="danger" onPress={() => onDelete(client.id)} /> : null}
    </>
  );
}
