import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { DateField } from '@/components/DateField';
import { Sheet } from '@/components/Sheet';
import { Button, Card, Chip, Row, T } from '@/components/ui';
import { listBillsForExport, type ExportBill } from '@/db/repo';
import { useTheme } from '@/hooks/use-theme';
import { makeBillTranslator } from '@/i18n';
import { useT } from '@/i18n/I18nProvider';
import { shareCsv } from '@/lib/backupFiles';
import { billLinesCsv, billsCsv, csvFileName } from '@/lib/csv';
import { errorText } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { PERIOD_PRESETS, formatPeriod, presetPeriod, type Period, type PeriodPreset } from '@/lib/period';
import type { Profile } from '@/types';

type Choice = PeriodPreset | 'all' | 'custom';

/** Bills in a period as a CSV that opens in Excel or Google Sheets. */
export function ExportSheet({ visible, profile, onClose }: { visible: boolean; profile: Profile; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet visible={visible} title={t('export.title')} onClose={onClose}>
      <ExportForm profile={profile} onClose={onClose} />
    </Sheet>
  );
}

function ExportForm({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const db = useSQLiteContext();
  const c = useTheme();
  const { t, tn, lang } = useT();
  const [choice, setChoice] = useState<Choice>('this-fy');
  const [custom, setCustom] = useState<Period>(() => presetPeriod('this-month'));
  const [bills, setBills] = useState<ExportBill[] | null>(null);
  const [busy, setBusy] = useState(false);

  const period: Period | null = choice === 'all' ? null : choice === 'custom' ? custom : presetPeriod(choice);
  const valid = !period || period.start <= period.end;
  const start = period?.start ?? null;
  const end = period?.end ?? null;

  useEffect(() => {
    if (start && end && start > end) return;
    let active = true;
    listBillsForExport(db, start && end ? { start, end } : null).then((b) => active && setBills(b));
    return () => {
      active = false;
    };
  }, [db, start, end]);

  async function share(kind: 'Bills' | 'Bill-items') {
    if (!bills) return;
    setBusy(true);
    try {
      // Column headings follow the bill language, like every other document sent out.
      const bt = makeBillTranslator(profile.bill_language);
      const csv = kind === 'Bills' ? billsCsv(bills, bt.t) : billLinesCsv(bills, bt.t, bt.unit);
      await shareCsv(csvFileName(kind, start, end), csv, t('export.title'));
    } catch (e) {
      Alert.alert(t('export.failed'), errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  const total = (bills ?? []).reduce((s, b) => s + b.total_minor, 0);
  const empty = !bills?.length;

  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        {PERIOD_PRESETS.map((p) => (
          <Chip key={p.value} label={t(p.label)} selected={choice === p.value} onPress={() => setChoice(p.value)} />
        ))}
        <Chip label={t('export.allTime')} selected={choice === 'all'} onPress={() => setChoice('all')} />
        <Chip label={t('period.custom')} selected={choice === 'custom'} onPress={() => setChoice('custom')} />
      </Row>

      {choice === 'custom' ? (
        <>
          <DateField label={t('period.from')} value={custom.start} onChange={(s) => setCustom((p) => ({ ...p, start: s }))} />
          <DateField label={t('period.to')} value={custom.end} onChange={(e) => setCustom((p) => ({ ...p, end: e }))} />
        </>
      ) : null}

      <Card>
        <T style={{ fontWeight: '600' }}>
          {!valid ? t('period.invalid') : period ? formatPeriod(period, lang) : t('export.allTime')}
        </T>
        {valid && bills ? (
          empty ? (
            <T muted>{t('export.noBills')}</T>
          ) : (
            <T muted>
              {tn('common.bills', bills.length)} ·{' '}
              <T style={{ fontWeight: '700' }}>{formatMoney(total, profile.currency)}</T>
            </T>
          )
        ) : null}
        <T muted style={{ fontSize: 12 }}>{t('export.hint')}</T>
      </Card>

      <Button
        title={t('export.bills')}
        icon={<Ionicons name="receipt-outline" size={18} color={c.primaryText} />}
        onPress={() => share('Bills')}
        loading={busy}
        disabled={!valid || empty}
      />
      <Button
        title={t('export.lines')}
        variant="secondary"
        icon={<Ionicons name="list-outline" size={18} color={c.primary} />}
        onPress={() => share('Bill-items')}
        disabled={!valid || empty || busy}
      />
      <Button title={t('common.cancel')} variant="secondary" onPress={onClose} />
    </>
  );
}
