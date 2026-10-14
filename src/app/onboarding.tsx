import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProfileForm } from '@/components/ProfileForm';
import { Card, Row, SectionTitle, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { completeOnboarding } from '@/db/repo';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import { PRESETS, type TradePreset } from '@/lib/presets';

export default function Onboarding() {
  const db = useSQLiteContext();
  const c = useTheme();
  const [preset, setPreset] = useState<TradePreset | null>(null);

  if (!preset) {
    return (
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
        <T style={{ fontSize: 20, fontWeight: '700' }}>What do you bill for?</T>
        <T muted>We’ll add common items and rates for your work so your first bill takes seconds.</T>
        <View style={styles.grid}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.trade}
              accessibilityRole="button"
              onPress={() => setPreset(p)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name={p.icon} size={28} color={c.primary} />
              <T style={{ fontWeight: '600' }}>{p.label}</T>
              <T muted style={{ fontSize: 12 }}>{p.hint}</T>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }} keyboardShouldPersistTaps="handled">
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <Ionicons name={preset.icon} size={20} color={c.primary} />
            <T style={{ fontWeight: '600' }}>{preset.label}</T>
          </Row>
          <Pressable onPress={() => setPreset(null)} hitSlop={10}>
            <T style={{ color: c.primary }}>Change</T>
          </Pressable>
        </Row>

        {preset.items.length ? (
          <Card>
            <SectionTitle>We’ll add these items</SectionTitle>
            {preset.items.map((i) => (
              <Row key={i.name} style={{ justifyContent: 'space-between' }}>
                <T>{i.name}</T>
                <T muted>
                  {formatMoney(i.price_minor, '₹')} / {i.unit}
                </T>
              </Row>
            ))}
            <T muted style={{ fontSize: 12 }}>Rates are a starting point — change them anytime in the Items tab.</T>
          </Card>
        ) : null}

        <T muted>These details appear at the top of every bill you share. You can change them later in Settings.</T>
        <ProfileForm
          // Keyed so switching trade resets the suggested prefix.
          key={preset.trade}
          initial={{ bill_prefix: preset.billPrefix }}
          submitLabel="Start making bills"
          onSubmit={async (p) => {
            await completeOnboarding(db, p, preset.trade);
            router.replace('/');
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  tile: {
    // Two columns: half width minus half the gap.
    width: '47.5%',
    flexGrow: 1,
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
});
