import { useState } from 'react';

import { DateField } from '@/components/DateField';
import { Sheet } from '@/components/Sheet';
import { Button, Card, Chip, Row, T } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { billableEntries, sumEntries } from '@/lib/entries';
import { formatDate, formatMoney, todayISO } from '@/lib/money';
import { PERIOD_PRESETS, formatPeriod, presetPeriod, type Period, type PeriodPreset } from '@/lib/period';
import type { Entry } from '@/types';

type Props = {
  visible: boolean;
  /** "bill" bills unbilled entries in the period; "statement" summarizes bills sent in it */
  mode: 'bill' | 'statement';
  /** the client's entries, for the bill preview */
  entries: Entry[];
  currency: string;
  onClose: () => void;
  onConfirm: (period: Period) => Promise<void>;
};

export function PeriodModal(props: Props) {
  const { t } = useT();
  return (
    <Sheet
      visible={props.visible}
      title={t(props.mode === 'bill' ? 'period.billFor' : 'period.statementFor')}
      onClose={props.onClose}>
      <PeriodForm {...props} />
    </Sheet>
  );
}

function PeriodForm({ mode, entries, currency, onClose, onConfirm }: Props) {
  const [choice, setChoice] = useState<PeriodPreset | 'custom'>(mode === 'bill' ? 'this-month' : 'this-fy');
  const [custom, setCustom] = useState<Period>(() => presetPeriod('this-month'));
  const [busy, setBusy] = useState(false);
  const { t, tn, lang } = useT();

  const period = choice === 'custom' ? custom : presetPeriod(choice);
  const valid = period.start <= period.end;
  const preview = sumEntries(billableEntries(entries, period));

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm(period);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        {PERIOD_PRESETS.map((p) => (
          <Chip key={p.value} label={t(p.label)} selected={choice === p.value} onPress={() => setChoice(p.value)} />
        ))}
        <Chip label={t('period.custom')} selected={choice === 'custom'} onPress={() => setChoice('custom')} />
      </Row>

      {choice === 'custom' ? (
        <>
          <DateField label={t('period.from')} value={custom.start} onChange={(start) => setCustom((p) => ({ ...p, start }))} />
          <DateField label={t('period.to')} value={custom.end} onChange={(end) => setCustom((p) => ({ ...p, end }))} />
        </>
      ) : null}

      <Card>
        <T style={{ fontWeight: '600' }}>{valid ? formatPeriod(period, lang) : t('period.invalid')}</T>
        {mode === 'bill' && valid ? (
          preview.count ? (
            <T muted>
              {tn('period.unbilledPreview', preview.count)}{' '}
              <T style={{ fontWeight: '700' }}>{formatMoney(preview.total_minor, currency)}</T>
            </T>
          ) : (
            <T muted>{t('client.noEntriesInPeriod')}</T>
          )
        ) : null}
        {mode === 'bill' ? (
          <T muted style={{ fontSize: 12 }}>{t('period.billHint', { date: formatDate(todayISO(), lang) })}</T>
        ) : (
          <T muted style={{ fontSize: 12 }}>{t('period.statementHint')}</T>
        )}
      </Card>

      <Row>
        <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={t(mode === 'bill' ? 'client.createBill' : 'period.sharePdf')}
          onPress={confirm}
          loading={busy}
          disabled={!valid || (mode === 'bill' && preview.count === 0)}
          style={{ flex: 1 }}
        />
      </Row>
    </>
  );
}
