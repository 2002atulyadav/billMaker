import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Card, Chip, Row, SectionTitle, T } from '@/components/ui';
import { setTrade } from '@/db/repo';
import { PRESETS, presetFor } from '@/lib/presets';
import type { Trade } from '@/types';

/** Switches the business type, which decides the units and work-entry fields the app offers. */
export function BusinessTypeCard({ trade: initial }: { trade: Trade }) {
  const db = useSQLiteContext();
  const [trade, setLocalTrade] = useState(initial);
  const current = presetFor(trade);

  function choose(next: Trade) {
    if (next === trade) return;
    const preset = presetFor(next);
    const apply = async (addItems: boolean) => {
      const added = await setTrade(db, next, addItems);
      setLocalTrade(next);
      if (addItems) Alert.alert('Done', added ? `Added ${added} starter items.` : 'You already had these items.');
    };
    Alert.alert(
      `Switch to ${preset.label}?`,
      'Units and work-entry fields will change. Your items, clients and bills stay as they are.',
      [
        { text: 'Cancel', style: 'cancel' },
        ...(preset.items.length ? [{ text: 'Switch + add starter items', onPress: () => apply(true) }] : []),
        { text: 'Switch', onPress: () => apply(false) },
      ],
    );
  }

  return (
    <Card>
      <SectionTitle>Business type</SectionTitle>
      <Row style={{ flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <Chip key={p.trade} label={p.label} selected={p.trade === trade} onPress={() => choose(p.trade)} />
        ))}
      </Row>
      <T muted style={{ fontSize: 12 }}>
        Units: {current.units.join(', ')}
        {current.entryFields.length ? ` · Entry fields: ${current.entryFields.map((f) => f.label).join(', ')}` : ''}
      </T>
    </Card>
  );
}
