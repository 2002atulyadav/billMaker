import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Field, SectionTitle, T } from '@/components/ui';
import { getMinNextBillNo, getProfile, setNextBillNo } from '@/db/repo';
import { useT } from '@/i18n/I18nProvider';
import { errorText } from '@/lib/errors';
import { formatBillNo } from '@/lib/money';

/** Shows and edits the next bill number. `version` changes after a profile save so a new prefix is picked up. */
export function BillNumberCard({ version }: { version: number }) {
  const db = useSQLiteContext();
  const { t } = useT();
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
      setError(t('numbering.invalid'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await setNextBillNo(db, n);
      setCurrent(n);
      Alert.alert(t('common.saved'), t('numbering.saved', { billNo: formatBillNo(prefix, n) }));
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionTitle>{t('numbering.title')}</SectionTitle>
      <Field
        label={t('numbering.next')}
        keyboardType="number-pad"
        value={value}
        onChangeText={setValue}
        error={error}
        maxLength={7}
      />
      <T muted style={{ fontSize: 12 }}>
        {n !== null && n >= 1 ? `${t('numbering.preview', { billNo: formatBillNo(prefix, n) })} ` : ''}
        {t('numbering.hint', { min })}
      </T>
      {n !== current ? <Button title={t('numbering.update')} variant="secondary" onPress={save} loading={saving} /> : null}
    </Card>
  );
}
