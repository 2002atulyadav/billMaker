import { Image } from 'expo-image';
import type { ReactNode, Ref } from 'react';
import { Platform, StyleSheet, Text, View, type TextProps } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { makeBillTranslator } from '@/i18n';
import { amountWords } from '@/lib/billHtml';
import { profileTheme, type BillThemeTokens } from '@/lib/billTheme';
import { detailsText } from '@/lib/entries';
import { formatDate, formatMoney, formatQty } from '@/lib/money';
import { formatPeriod } from '@/lib/period';
import { qrMatrix, upiLink } from '@/lib/upi';
import type { BillWithLines, Profile } from '@/types';

/**
 * The bill as a printed slip, drawn in the owner's bill theme. Always light, regardless of app theme,
 * because this exact view is captured as an image when sharing. Mirrors the PDF in billHtml.ts, so
 * change both together.
 */
export function BillPaper({ bill, profile, ref }: { bill: BillWithLines; profile: Profile; ref?: Ref<View> }) {
  const money = (m: number) => formatMoney(m, profile.currency);
  // Follows the bill language (not the app language): this view is what gets shared as an image.
  const tr = makeBillTranslator(profile.bill_language);
  const tk = profileTheme(profile);
  const isPaid = bill.status === 'paid';
  // Mirrors billHtml.ts: the QR asks only for what's still due.
  const balance = Math.max(0, bill.total_minor - bill.paid_minor);
  const partPaid = !isPaid && bill.paid_minor > 0;
  const showPay = !isPaid && !!profile.upi_id && balance > 0;
  const words = tk.amountInWords ? amountWords(bill.total_minor, profile) : [];
  const mono = tk.mono ? { fontFamily: MONO } : null;
  const dashed = { borderStyle: 'dashed' as const, borderColor: PAPER.text };

  const stamp = isPaid ? (
    <View style={[styles.stamp, tk.headerStyle === 'band' && { backgroundColor: '#FFFFFF' }, tk.mono && { borderColor: PAPER.text }]}>
      <Text maxFontSizeMultiplier={PAPER_FONT_SCALE} style={[styles.stampText, tk.mono && { color: PAPER.text }]}>
        {/* Bilingual "PAID / भुगतान हुआ" stacks into two short lines so the stamp stays compact */}
        {tr.t('pdf.paid').split(' / ').join('\n')}
      </Text>
    </View>
  ) : null;
  const dueLine =
    !isPaid && bill.due_date ? `${tr.t('pdf.dueDate')}: ${formatDate(bill.due_date, tr.lang)}` : '';

  const body = (
    <>
      <Head bill={bill} profile={profile} tk={tk} dateText={formatDate(bill.date, tr.lang)} dueText={dueLine} stamp={stamp} />

      {bill.customer_name || bill.customer_phone ? (
        <View style={{ marginTop: Spacing.three }}>
          <P muted style={styles.label}>{tr.t('pdf.billTo')}</P>
          {bill.customer_name ? (
            <P style={[{ fontWeight: '600' }, mono]}>
              {tk.theme === 'bahi' ? `${tr.t('pdf.ms')} ` : ''}
              {bill.customer_name}
            </P>
          ) : null}
          {bill.customer_address ? <P muted>{bill.customer_address}</P> : null}
          {bill.customer_phone ? <P muted>{bill.customer_phone}</P> : null}
        </View>
      ) : null}

      {bill.period_start && bill.period_end ? (
        <View style={[styles.period, { backgroundColor: tk.mono ? '#FFFFFF' : tk.accentSoft }, tk.mono && { borderWidth: 1, ...dashed }]}>
          <P muted style={styles.label}>{tr.t('pdf.billingPeriod')}</P>
          <P style={{ fontWeight: '600' }}>
            {formatPeriod({ start: bill.period_start, end: bill.period_end }, tr.lang)} ·{' '}
            {tr.tn('common.entries', bill.lines.length)}
          </P>
        </View>
      ) : null}

      <View
        style={[
          { marginTop: Spacing.three },
          tk.tableStyle === 'grid' && { borderWidth: 1, borderColor: GRID },
        ]}>
        {tk.tableStyle !== 'rows' ? (
          <View
            style={[
              styles.tableHead,
              tk.tableStyle === 'tinted' && { backgroundColor: tk.accentSoft },
              tk.tableStyle === 'grid' && { backgroundColor: tk.accentSoft, borderBottomWidth: 1, borderColor: GRID },
              tk.tableStyle === 'plain' && { borderBottomWidth: 1, ...dashed },
            ]}>
            <P style={[styles.label, { color: tk.tableStyle === 'tinted' ? tk.accent : PAPER.text, flex: 1 }]}>{tr.t('pdf.item')}</P>
            <P style={[styles.label, { color: tk.tableStyle === 'tinted' ? tk.accent : PAPER.text }]}>{tr.t('pdf.amount')}</P>
          </View>
        ) : null}
        {bill.lines.map((l, i) => {
          const extra = detailsText(bill.detail_fields, l.details);
          return (
            <View
              key={i}
              style={[
                styles.line,
                tk.tableStyle === 'grid' && { borderColor: GRID, borderBottomWidth: i === bill.lines.length - 1 ? 0 : 1, paddingHorizontal: Spacing.two },
                tk.tableStyle === 'plain' && { borderBottomWidth: 0, paddingVertical: Spacing.one },
                tk.tableStyle === 'tinted' && { paddingHorizontal: Spacing.two },
              ]}>
              <View style={{ flex: 1 }}>
                {l.entry_date ? <P muted style={{ fontSize: 12 }}>{formatDate(l.entry_date, tr.lang)}</P> : null}
                <P style={[{ fontWeight: '500' }, mono]}>{l.description}</P>
                {extra ? <P muted style={{ fontSize: 13 }}>{extra}</P> : null}
                <P muted style={[{ fontSize: 13 }, mono]}>
                  {formatQty(l.qty)}
                  {l.unit ? ` ${tr.unit(l.unit)}` : ''} × {money(l.unit_price_minor)}
                </P>
              </View>
              <P style={[{ fontWeight: '600' }, mono]}>{money(l.line_total_minor)}</P>
            </View>
          );
        })}
      </View>

      <View
        style={[
          styles.totals,
          tk.headerStyle === 'band' && { backgroundColor: tk.accentSoft, padding: Spacing.three, borderRadius: 10, marginTop: Spacing.three },
          tk.mono && { borderTopWidth: 1, ...dashed, paddingTop: Spacing.two },
        ]}>
        <View style={styles.totalRow}>
          <P muted>{tr.t('pdf.subtotal')}</P>
          <P style={mono}>{money(bill.subtotal_minor)}</P>
        </View>
        {bill.discount_minor > 0 ? (
          <View style={styles.totalRow}>
            <P muted>{tr.t('pdf.discount')}</P>
            <P style={mono}>-{money(bill.discount_minor)}</P>
          </View>
        ) : null}
        <View style={[styles.totalRow, styles.grand, tk.headerStyle === 'band' && { borderColor: tk.accent }, tk.mono && { borderTopWidth: 1, ...dashed }]}>
          <P style={{ fontSize: 17, fontWeight: '700', color: tk.headerStyle === 'band' ? tk.accent : PAPER.text }}>{tr.t('pdf.total')}</P>
          <P style={[{ fontSize: 22, fontWeight: '700', color: tk.headerStyle === 'band' ? tk.accent : PAPER.text }, mono]}>
            {money(bill.total_minor)}
          </P>
        </View>
        {partPaid ? (
          <>
            <View style={styles.totalRow}>
              <P muted>{tr.t('pdf.paidAmount')}</P>
              <P style={mono}>-{money(bill.paid_minor)}</P>
            </View>
            <View style={[styles.totalRow, styles.grand]}>
              <P style={{ fontSize: 17, fontWeight: '700' }}>{tr.t('pdf.balanceDue')}</P>
              <P style={[{ fontSize: 22, fontWeight: '700', color: tk.mono ? PAPER.text : PAPER.due }, mono]}>{money(balance)}</P>
            </View>
          </>
        ) : null}
      </View>

      {words.length ? (
        <View style={styles.words}>
          <P muted style={styles.label}>{tr.t('pdf.amountInWords')}</P>
          {words.map((w) => (
            <P key={w} style={{ fontWeight: '600', fontSize: 14 }}>
              {w}
            </P>
          ))}
        </View>
      ) : null}

      {bill.notes ? (
        <View style={[styles.notes, tk.mono && { backgroundColor: '#FFFFFF', borderWidth: 1, borderRadius: 0, ...dashed }]}>
          <P muted style={styles.label}>{tr.t('pdf.notes')}</P>
          <P>{bill.notes}</P>
        </View>
      ) : null}

      {showPay ? (
        <View style={[styles.pay, tk.mono && { flexDirection: 'column', borderRadius: 0, ...dashed }]}>
          <UpiQr
            text={upiLink({
              upiId: profile.upi_id,
              payeeName: profile.business_name,
              amountMinor: balance,
              note: bill.bill_no,
            })}
            size={112}
          />
          <View style={[{ flex: tk.mono ? 0 : 1, gap: 2 }, tk.mono && { alignItems: 'center' }]}>
            <P muted style={styles.label}>{tr.t('pdf.scanToPay')}</P>
            <P style={[{ fontSize: 18, fontWeight: '700' }, mono]}>{money(balance)}</P>
            <P muted style={{ fontSize: 13 }}>
              {tr.t('pdf.upiId')}: {profile.upi_id}
            </P>
          </View>
        </View>
      ) : null}

      {tk.signature ? (
        <View style={styles.sign}>
          <View style={styles.signLine} />
          <P muted style={{ fontSize: 13 }}>{tr.t('pdf.signature')}</P>
        </View>
      ) : null}
    </>
  );

  return (
    // collapsable={false} keeps this View in the native hierarchy on Android so captureRef can find it.
    <View ref={ref} collapsable={false} style={[styles.paper, tk.pageBorder && { padding: Spacing.two }]}>
      {tk.pageBorder ? (
        // A double rule around the page, like a printed bill book.
        <View style={[styles.doubleOuter, { borderColor: tk.accent }]}>
          <View style={[styles.doubleInner, { borderColor: tk.accent }]}>{body}</View>
        </View>
      ) : (
        body
      )}
    </View>
  );
}

/** The top of the bill: business on one side and bill number on the other, or centred, depending on the theme. */
function Head({
  bill,
  profile,
  tk,
  dateText,
  dueText,
  stamp,
}: {
  bill: BillWithLines;
  profile: Profile;
  tk: BillThemeTokens;
  dateText: string;
  dueText: string;
  stamp: ReactNode;
}) {
  const logo = profile.logo_uri ? (
    <Image source={{ uri: profile.logo_uri }} style={tk.mono ? styles.logoSmall : styles.logo} contentFit="contain" />
  ) : null;
  const onBand = tk.headerStyle === 'band';
  const fg = onBand ? '#FFFFFF' : undefined;
  const sub = onBand ? { color: 'rgba(255,255,255,0.88)' } : null;

  if (tk.headerStyle === 'centred' || tk.headerStyle === 'compact') {
    const centred = tk.headerStyle === 'centred';
    return (
      <View
        style={[
          styles.headCentred,
          centred ? { borderColor: tk.accent, borderBottomWidth: 1 } : { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: PAPER.text },
        ]}>
        {logo}
        <P style={[styles.bizName, { textAlign: 'center' }, centred && { color: tk.accent, fontSize: 22 }, tk.mono && { fontFamily: MONO }]}>
          {profile.business_name}
        </P>
        {profile.phone ? <P muted style={{ textAlign: 'center' }}>{profile.phone}</P> : null}
        {profile.address ? <P muted style={{ textAlign: 'center' }}>{profile.address}</P> : null}
        <View style={styles.headMetaRow}>
          <P style={[styles.billNo, { color: tk.accent }, tk.mono && { fontFamily: MONO }]}>{bill.bill_no}</P>
          <P muted>{dateText}</P>
        </View>
        {dueText ? <P muted style={{ fontSize: 13 }}>{dueText}</P> : null}
        {stamp}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.head,
        { borderColor: tk.accent },
        onBand && { backgroundColor: tk.accent, borderBottomWidth: 0, borderRadius: 10, padding: Spacing.three, alignItems: 'center' },
      ]}>
      <View style={{ flexDirection: 'row', gap: Spacing.three, flex: 1, alignItems: 'center' }}>
        {logo}
        <View style={{ flex: 1 }}>
          <P style={[styles.bizName, fg && { color: fg }]}>{profile.business_name}</P>
          {profile.phone ? <P muted style={sub}>{profile.phone}</P> : null}
          {profile.address ? <P muted style={sub}>{profile.address}</P> : null}
        </View>
      </View>
      {/* Capped so a long bilingual stamp ("PAID / भुगतान हुआ") can't squeeze the business name. */}
      <View style={{ alignItems: 'flex-end', maxWidth: '45%' }}>
        <P style={[styles.billNo, { color: fg ?? tk.accent }]}>{bill.bill_no}</P>
        <P muted style={sub}>{dateText}</P>
        {dueText ? <P muted style={[{ fontSize: 13 }, sub]}>{dueText}</P> : null}
        {stamp}
      </View>
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

const PAPER_FONT_SCALE = 1.2;
const PAPER = { text: '#111418', muted: '#60646C', border: '#E5E7EB', paid: '#1A7F37', due: '#9A6700' };
const GRID = '#555555';
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Text with fixed paper colors (ignores dark mode). */
function P({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  // Capped lower than app text: the shared image should look like a bill, not grow with the phone's text size.
  return (
    <Text
      maxFontSizeMultiplier={PAPER_FONT_SCALE}
      {...props}
      style={[{ color: muted ? PAPER.muted : PAPER.text, fontSize: 15 }, style]}
    />
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: Spacing.four, gap: Spacing.one },
  head: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: 2,
  },
  headCentred: { alignItems: 'center', gap: 2, paddingBottom: Spacing.three },
  headMetaRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two, alignItems: 'center' },
  logoSmall: { width: 36, height: 36, borderRadius: 6 },
  doubleOuter: { borderWidth: 2, padding: 3 },
  doubleInner: { borderWidth: 1, padding: Spacing.three, gap: Spacing.one },
  tableHead: { flexDirection: 'row', paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  words: { marginTop: Spacing.three, padding: Spacing.three, borderWidth: 1, borderColor: '#999999' },
  sign: { marginTop: Spacing.six, alignItems: 'flex-end', gap: 4 },
  signLine: { width: 180, borderTopWidth: 1, borderColor: '#333333' },
  logo: { width: 48, height: 48, borderRadius: 8 },
  bizName: { fontSize: 18, fontWeight: '700' },
  billNo: { fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  stamp: {
    marginTop: Spacing.two,
    borderWidth: 2,
    borderColor: PAPER.paid,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
    transform: [{ rotate: '-6deg' }],
  },
  stampText: { textAlign: 'center', color: PAPER.paid, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.border,
  },
  period: { marginTop: Spacing.three, padding: Spacing.three, borderRadius: 6 },
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
