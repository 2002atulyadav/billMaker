import { Image } from 'expo-image';
import type { Ref } from 'react';
import { StyleSheet, Text, View, type TextProps } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { formatDate, formatMoney, formatQty } from '@/lib/money';
import { qrMatrix, upiLink } from '@/lib/upi';
import type { BillWithLines, Profile } from '@/types';

/**
 * The bill as a printed slip. Always light, regardless of app theme, because this exact view is
 * captured as an image when sharing — mirrors the PDF layout in billHtml.ts.
 */
export function BillPaper({ bill, profile, ref }: { bill: BillWithLines; profile: Profile; ref?: Ref<View> }) {
  const money = (m: number) => formatMoney(m, profile.currency);
  const isPaid = bill.status === 'paid';
  const showPay = !isPaid && !!profile.upi_id && bill.total_minor > 0;

  return (
    // collapsable={false} keeps this View in the native hierarchy on Android so captureRef can find it.
    <View ref={ref} collapsable={false} style={styles.paper}>
      <View style={styles.head}>
        <View style={{ flexDirection: 'row', gap: Spacing.three, flex: 1, alignItems: 'center' }}>
          {profile.logo_uri ? <Image source={{ uri: profile.logo_uri }} style={styles.logo} contentFit="contain" /> : null}
          <View style={{ flex: 1 }}>
            <P style={styles.bizName}>{profile.business_name}</P>
            {profile.phone ? <P muted>{profile.phone}</P> : null}
            {profile.address ? <P muted>{profile.address}</P> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <P style={styles.billNo}>{bill.bill_no}</P>
          <P muted>{formatDate(bill.date)}</P>
          {isPaid ? (
            <View style={styles.stamp}>
              <Text style={styles.stampText}>PAID</Text>
            </View>
          ) : null}
        </View>
      </View>

      {bill.customer_name || bill.customer_phone ? (
        <View style={{ marginTop: Spacing.three }}>
          <P muted style={styles.label}>BILL TO</P>
          {bill.customer_name ? <P style={{ fontWeight: '600' }}>{bill.customer_name}</P> : null}
          {bill.customer_phone ? <P muted>{bill.customer_phone}</P> : null}
        </View>
      ) : null}

      <View style={{ marginTop: Spacing.three }}>
        {bill.lines.map((l, i) => (
          <View key={i} style={styles.line}>
            <View style={{ flex: 1 }}>
              <P style={{ fontWeight: '500' }}>{l.description}</P>
              <P muted style={{ fontSize: 13 }}>
                {formatQty(l.qty)}
                {l.unit ? ` ${l.unit}` : ''} × {money(l.unit_price_minor)}
              </P>
            </View>
            <P style={{ fontWeight: '600' }}>{money(l.line_total_minor)}</P>
          </View>
        ))}
      </View>

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <P muted>Subtotal</P>
          <P>{money(bill.subtotal_minor)}</P>
        </View>
        {bill.discount_minor > 0 ? (
          <View style={styles.totalRow}>
            <P muted>Discount</P>
            <P>-{money(bill.discount_minor)}</P>
          </View>
        ) : null}
        <View style={[styles.totalRow, styles.grand]}>
          <P style={{ fontSize: 17, fontWeight: '700' }}>Total</P>
          <P style={{ fontSize: 22, fontWeight: '700' }}>{money(bill.total_minor)}</P>
        </View>
      </View>

      {bill.notes ? (
        <View style={styles.notes}>
          <P muted style={styles.label}>NOTES</P>
          <P>{bill.notes}</P>
        </View>
      ) : null}

      {showPay ? (
        <View style={styles.pay}>
          <UpiQr
            text={upiLink({
              upiId: profile.upi_id,
              payeeName: profile.business_name,
              amountMinor: bill.total_minor,
              note: bill.bill_no,
            })}
            size={112}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <P muted style={styles.label}>SCAN TO PAY WITH ANY UPI APP</P>
            <P style={{ fontSize: 18, fontWeight: '700' }}>{money(bill.total_minor)}</P>
            <P muted style={{ fontSize: 13 }}>UPI ID: {profile.upi_id}</P>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function UpiQr({ text, size }: { text: string; size: number }) {
  const { size: n, path } = qrMatrix(text);
  const vb = n + 8; // 4-module quiet zone on each side
  return (
    <Svg width={size} height={size} viewBox={`-4 -4 ${vb} ${vb}`}>
      <Rect x={-4} y={-4} width={vb} height={vb} fill="#FFFFFF" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
}

const PAPER = { text: '#111418', muted: '#60646C', border: '#E5E7EB', accent: '#1F6FEB', paid: '#1A7F37' };

/** Text with fixed paper colors (ignores dark mode). */
function P({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  return <Text {...props} style={[{ color: muted ? PAPER.muted : PAPER.text, fontSize: 15 }, style]} />;
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: Spacing.four, gap: Spacing.one },
  head: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: 2,
    borderColor: PAPER.accent,
  },
  logo: { width: 48, height: 48, borderRadius: 8 },
  bizName: { fontSize: 18, fontWeight: '700' },
  billNo: { fontWeight: '700', color: PAPER.accent },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  stamp: {
    marginTop: Spacing.two,
    borderWidth: 2,
    borderColor: PAPER.paid,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
    transform: [{ rotate: '-6deg' }],
  },
  stampText: { color: PAPER.paid, fontWeight: '800', letterSpacing: 2 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.border,
  },
  totals: { marginTop: Spacing.two, gap: Spacing.one },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grand: { borderTopWidth: 2, borderColor: PAPER.text, marginTop: Spacing.one, paddingTop: Spacing.two },
  notes: { marginTop: Spacing.three, padding: Spacing.three, backgroundColor: '#F7F8FA', borderRadius: 6 },
  pay: {
    marginTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: PAPER.border,
    borderRadius: 8,
  },
});
