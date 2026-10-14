import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Field, SectionTitle, T } from '@/components/ui';
import { getMinNextBillNo, getProfile, setNextBillNo } from '@/db/repo';
import { formatBillNo } from '@/lib/money';

/** Shows and edits the next bill number. `version` changes after a profile save so a new prefix is picked up. */
export function BillNumberCard({ version }: { version: number }) {
  const db = useSQLiteContext();
  const [prefix, setPrefix] = useState('');
  const [current, setCurrent] = useState<number | null>(null);
  const [min, setMin] = useState(1);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getProfile(db), getMinNextBillNo(db)]).then(([p, m]) => {
      if (!p) return;
      setPrefix(p.bill_prefix);
      setCurrent(p.next_bill_no);
      setValue(String(p.next_bill_no));
      setMin(m);
    });
  }, [db, version]);

  if (current === null) return null;

  const n = /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;

  async function save() {
    if (n === null || n < 1) {
      setError('Enter a whole number like 101');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await setNextBillNo(db, n);
      setCurrent(n);
      Alert.alert('Saved', `Your next bill will be ${formatBillNo(prefix, n)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Bill numbering</SectionTitle>
      <Field
        label="Next bill number"
        keyboardType="number-pad"
        value={value}
        onChangeText={setValue}
        error={error}
        maxLength={7}
      />
      <T muted style={{ fontSize: 12 }}>
        {n !== null && n >= 1 ? `Next bill will be ${formatBillNo(prefix, n)}. ` : ''}
        Coming from a paper bill book? Set this to continue your numbering. Must be {min} or higher.
      </T>
      {n !== current ? <Button title="Update numbering" variant="secondary" onPress={save} loading={saving} /> : null}
    </Card>
  );
}
