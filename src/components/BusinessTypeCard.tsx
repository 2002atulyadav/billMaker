import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Card, Chip, Row, SectionTitle, T } from '@/components/ui';
import { setTrade } from '@/db/repo';
import { useT } from '@/i18n/I18nProvider';
import { PRESETS, presetFor } from '@/lib/presets';
import type { Trade } from '@/types';

/** Switches the business type, which decides the units and work-entry fields the app offers. */
export function BusinessTypeCard({ trade: initial }: { trade: Trade }) {
  const db = useSQLiteContext();
  const { t, tn, unit, dyn, lang } = useT();
  const [trade, setLocalTrade] = useState(initial);
  const current = presetFor(trade);

  function choose(next: Trade) {
    if (next === trade) return;
    const preset = presetFor(next);
    const apply = async (addItems: boolean) => {
      const added = await setTrade(db, next, addItems, lang);
      setLocalTrade(next);
      if (addItems) Alert.alert(t('common.done'), added ? tn('trade.added', added) : t('trade.alreadyHad'));
    };
    Alert.alert(t('trade.switchTitle', { name: t(`trade.${next}.label`) }), t('trade.switchMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      ...(preset.items.length ? [{ text: t('trade.switchAndAdd'), onPress: () => apply(true) }] : []),
      { text: t('trade.switch'), onPress: () => apply(false) },
    ]);
  }

  return (
    <Card>
      <SectionTitle>{t('trade.title')}</SectionTitle>
      <Row style={{ flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <Chip key={p.trade} label={t(`trade.${p.trade}.label`)} selected={p.trade === trade} onPress={() => choose(p.trade)} />
        ))}
      </Row>
      <T muted style={{ fontSize: 12 }}>
        {t('trade.units', { units: current.units.map(unit).join(', ') })}
        {current.entryFields.length
          ? ` · ${t('trade.fields', { fields: current.entryFields.map((f) => dyn(`field.${f.key}`, f.label)).join(', ') })}`
          : ''}
      </T>
    </Card>
  );
}
