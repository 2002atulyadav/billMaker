import { formatDate, formatMoney, formatQty } from '@/lib/money';
import { formatPeriod } from '@/lib/period';
import { qrSvg, upiLink } from '@/lib/upi';
import type { BillWithLines, Profile } from '@/types';

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function nl2br(s: string): string {
  return esc(s).replace(/\n/g, '<br/>');
}

/** Styles shared by the bill and statement PDFs. */
export const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: #111; margin: 0; padding: 32px; font-size: 13px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1F6FEB; padding-bottom: 16px; }
  .biz { display: flex; gap: 12px; align-items: center; }
  .logo { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; }
  .biz-name { font-size: 22px; font-weight: 700; }
  .muted { color: #60646C; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 26px; letter-spacing: 2px; color: #1F6FEB; }
  .meta { display: flex; justify-content: space-between; margin: 20px 0; }
  .label { text-transform: uppercase; font-size: 10px; letter-spacing: 1px; color: #60646C; margin-bottom: 4px; }
  .strong { font-weight: 600; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #F0F3F9; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; padding: 8px; }
  td { padding: 8px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; }
  .num { width: 28px; color: #60646C; }
  .nowrap { white-space: nowrap; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  .totals { margin-left: auto; width: 260px; margin-top: 16px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .grand { border-top: 2px solid #111; margin-top: 4px; padding-top: 8px !important; font-size: 17px; font-weight: 700; }
  .notes { margin-top: 24px; padding: 12px; background: #F7F8FA; border-radius: 6px; }
  .pay { display: flex; gap: 16px; align-items: center; margin-top: 24px; padding: 12px; border: 1px solid #E5E7EB; border-radius: 8px; page-break-inside: avoid; }
  .pay .strong { font-size: 18px; }
  .stamp { display: inline-block; margin-top: 8px; padding: 4px 12px; border: 2px solid #1A7F37; color: #1A7F37; border-radius: 6px; font-weight: 700; letter-spacing: 2px; transform: rotate(-6deg); }
  .thanks { text-align: center; margin-top: 40px; color: #60646C; }
`;

/** Business name, contact and logo on the left; `right` (title, number, date) on the right. */
export function businessHead(profile: Profile, right: string): string {
  const logo = profile.logo_uri?.startsWith('data:') ? `<img class="logo" src="${profile.logo_uri}" />` : '';
  return `<div class="head">
    <div class="biz">
      ${logo}
      <div>
        <div class="biz-name">${esc(profile.business_name)}</div>
        ${profile.owner_name ? `<div>${esc(profile.owner_name)}</div>` : ''}
        ${profile.phone ? `<div class="muted">${esc(profile.phone)}</div>` : ''}
        ${profile.address ? `<div class="muted">${nl2br(profile.address)}</div>` : ''}
      </div>
    </div>
    <div class="title">${right}
    </div>
  </div>`;
}

/** UPI QR block asking for `amountMinor`; empty when no UPI ID is set or nothing is due. */
export function payBlock(profile: Profile, amountMinor: number, note: string): string {
  if (!profile.upi_id || amountMinor <= 0) return '';
  const link = upiLink({ upiId: profile.upi_id, payeeName: profile.business_name, amountMinor, note });
  return `<div class="pay">
    ${qrSvg(link, 132)}
    <div>
      <div class="label">Scan to pay with any UPI app</div>
      <div class="strong">${esc(formatMoney(amountMinor, profile.currency))}</div>
      <div class="muted">UPI ID: ${esc(profile.upi_id)}</div>
    </div>
  </div>`;
}

/** Self-contained HTML (no external assets) rendered to PDF by expo-print. */
export function billToHtml(bill: BillWithLines, profile: Profile): string {
  const money = (m: number) => esc(formatMoney(m, profile.currency));

  // Period bills add a Date column and one column per trade field (From, To, Vehicle no., …).
  const hasDates = bill.lines.some((l) => l.entry_date);
  const fields = bill.detail_fields;
  const rows = bill.lines
    .map(
      (l, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        ${hasDates ? `<td class="nowrap">${l.entry_date ? esc(formatDate(l.entry_date)) : ''}</td>` : ''}
        <td>${esc(l.description)}</td>
        ${fields.map((f) => `<td>${esc(l.details[f.key] ?? '')}</td>`).join('')}
        <td class="r">${formatQty(l.qty)}${l.unit ? ' ' + esc(l.unit) : ''}</td>
        <td class="r">${money(l.unit_price_minor)}</td>
        <td class="r">${money(l.line_total_minor)}</td>
      </tr>`,
    )
    .join('');

  const isPaid = bill.status === 'paid';
  const pay = isPaid ? '' : payBlock(profile, bill.total_minor, bill.bill_no);

  const customer =
    bill.customer_name || bill.customer_phone
      ? `<div class="label">Bill to</div>
         <div class="strong">${esc(bill.customer_name)}</div>
         ${bill.customer_address ? `<div class="muted">${nl2br(bill.customer_address)}</div>` : ''}
         ${bill.customer_phone ? `<div>${esc(bill.customer_phone)}</div>` : ''}`
      : '';

  const period =
    bill.period_start && bill.period_end
      ? `<div class="r"><div class="label">Billing period</div>
         <div class="strong">${esc(formatPeriod({ start: bill.period_start, end: bill.period_end }))}</div>
         <div class="muted">${bill.lines.length} ${bill.lines.length === 1 ? 'entry' : 'entries'}</div></div>`
      : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
${BASE_CSS}</style></head>
<body>
  ${businessHead(profile, `
      <h1>BILL</h1>
      <div class="strong">${esc(bill.bill_no)}</div>
      <div class="muted">${esc(formatDate(bill.date))}</div>
      ${isPaid ? '<div class="stamp">PAID</div>' : ''}`)}

  <div class="meta"><div>${customer}</div>${period}</div>

  <table>
    <thead><tr><th>#</th>${hasDates ? '<th>Date</th>' : ''}<th>Item</th>${fields
      .map((f) => `<th>${esc(f.label)}</th>`)
      .join('')}<th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${money(bill.subtotal_minor)}</span></div>
    ${bill.discount_minor > 0 ? `<div><span>Discount</span><span>-${money(bill.discount_minor)}</span></div>` : ''}
    <div class="grand"><span>Total</span><span>${money(bill.total_minor)}</span></div>
  </div>

  ${pay}

  ${bill.notes ? `<div class="notes"><div class="label">Notes</div>${nl2br(bill.notes)}</div>` : ''}

  <div class="thanks">Thank you for your business!</div>
</body></html>`;
}
