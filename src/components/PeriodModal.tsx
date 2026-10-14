import { useState } from 'react';

import { DateField } from '@/components/DateField';
import { Sheet } from '@/components/Sheet';
import { Button, Card, Chip, Row, T } from '@/components/ui';
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
  return (
    <Sheet
      visible={props.visible}
      title={props.mode === 'bill' ? 'Create bill for…' : 'Statement for…'}
      onClose={props.onClose}>
      <PeriodForm {...props} />
    </Sheet>
  );
}

function PeriodForm({ mode, entries, currency, onClose, onConfirm }: Props) {
  const [choice, setChoice] = useState<PeriodPreset | 'custom'>(mode === 'bill' ? 'this-month' : 'this-fy');
  const [custom, setCustom] = useState<Period>(() => presetPeriod('this-month'));
  const [busy, setBusy] = useState(false);

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
          <Chip key={p.value} label={p.label} selected={choice === p.value} onPress={() => setChoice(p.value)} />
        ))}
        <Chip label="Custom" selected={choice === 'custom'} onPress={() => setChoice('custom')} />
      </Row>

      {choice === 'custom' ? (
        <>
          <DateField label="From" value={custom.start} onChange={(start) => setCustom((p) => ({ ...p, start }))} />
          <DateField label="To" value={custom.end} onChange={(end) => setCustom((p) => ({ ...p, end }))} />
        </>
      ) : null}

      <Card>
        <T style={{ fontWeight: '600' }}>{valid ? formatPeriod(period) : '“From” must be before “To”'}</T>
        {mode === 'bill' && valid ? (
          preview.count ? (
            <T muted>
              {preview.count} unbilled {preview.count === 1 ? 'entry' : 'entries'} ·{' '}
              <T style={{ fontWeight: '700' }}>{formatMoney(preview.total_minor, currency)}</T>
            </T>
          ) : (
            <T muted>No unbilled entries in this period.</T>
          )
        ) : null}
        {mode === 'bill' ? (
          <T muted style={{ fontSize: 12 }}>The bill is dated today ({formatDate(todayISO())}) and lists each entry with its date.</T>
        ) : (
          <T muted style={{ fontSize: 12 }}>Lists every bill sent in this period with what’s paid and what’s still due.</T>
        )}
      </Card>

      <Row>
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={mode === 'bill' ? 'Create bill' : 'Share PDF'}
          onPress={confirm}
          loading={busy}
          disabled={!valid || (mode === 'bill' && preview.count === 0)}
          style={{ flex: 1 }}
        />
      </Row>
    </>
  );
}
