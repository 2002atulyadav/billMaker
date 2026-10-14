import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Field, Row, SectionTitle, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isValidUpiId } from '@/lib/upi';
import type { ProfileInput } from '@/types';

const EMPTY: ProfileInput = {
  business_name: '',
  owner_name: '',
  phone: '',
  address: '',
  logo_uri: null,
  currency: '₹',
  bill_prefix: 'INV-',
  upi_id: '',
};

export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<ProfileInput> | null;
  submitLabel: string;
  onSubmit: (p: ProfileInput) => Promise<void>;
}) {
  const c = useTheme();
  const [p, setP] = useState<ProfileInput>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [upiError, setUpiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => setP((prev) => ({ ...prev, [k]: v }));

  async function pickLogo() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });
    const asset = res.canceled ? null : res.assets[0];
    if (asset?.base64) set('logo_uri', `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
  }

  async function submit() {
    const nameErr = p.business_name.trim() ? null : 'Business name is required';
    const upiErr = !p.upi_id.trim() || isValidUpiId(p.upi_id) ? null : 'Enter a UPI ID like yourname@okhdfc';
    setError(nameErr);
    setUpiError(upiErr);
    if (nameErr || upiErr) return;
    setSaving(true);
    try {
      await onSubmit({
        ...p,
        business_name: p.business_name.trim(),
        owner_name: p.owner_name.trim(),
        phone: p.phone.trim(),
        address: p.address.trim(),
        currency: p.currency.trim() || '₹',
        bill_prefix: p.bill_prefix.trim(),
        upi_id: p.upi_id.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: Spacing.four }}>
      <Card>
        <SectionTitle>Business</SectionTitle>
        <Row style={{ gap: Spacing.four }}>
          <Pressable
            onPress={pickLogo}
            style={[styles.logo, { borderColor: c.border, backgroundColor: c.background }]}>
            {p.logo_uri ? (
              <Image source={{ uri: p.logo_uri }} style={styles.logoImg} contentFit="contain" />
            ) : (
              <T muted style={{ fontSize: 12, textAlign: 'center' }}>Add{'\n'}logo</T>
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Field
              label="Business / your name *"
              placeholder="e.g. Sharma General Store"
              value={p.business_name}
              onChangeText={(v) => set('business_name', v)}
              error={error}
            />
          </View>
        </Row>
        {p.logo_uri ? (
          <Pressable onPress={() => set('logo_uri', null)}>
            <T style={{ color: c.danger, fontSize: 13 }}>Remove logo</T>
          </Pressable>
        ) : null}
        <Field label="Owner name" value={p.owner_name} onChangeText={(v) => set('owner_name', v)} />
        <Field label="Phone" keyboardType="phone-pad" value={p.phone} onChangeText={(v) => set('phone', v)} />
        <Field label="Address" multiline value={p.address} onChangeText={(v) => set('address', v)} />
      </Card>

      <Card>
        <SectionTitle>Bill settings</SectionTitle>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="Currency symbol" value={p.currency} onChangeText={(v) => set('currency', v)} maxLength={4} />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Bill number prefix"
              autoCapitalize="characters"
              value={p.bill_prefix}
              onChangeText={(v) => set('bill_prefix', v)}
              maxLength={10}
            />
          </View>
        </Row>
        <T muted style={{ fontSize: 12 }}>Bills will be numbered {p.bill_prefix}0001, {p.bill_prefix}0002, …</T>
      </Card>

      <Card>
        <SectionTitle>Get paid</SectionTitle>
        <Field
          label="UPI ID (optional)"
          placeholder="e.g. yourname@okhdfc"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={p.upi_id}
          onChangeText={(v) => set('upi_id', v)}
          error={upiError}
        />
        <T muted style={{ fontSize: 12 }}>
          Unpaid bills will show a QR code your customer can scan with GPay, PhonePe, Paytm or any UPI app.
        </T>
      </Card>

      <Button title={submitLabel} onPress={submit} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
});
