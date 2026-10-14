import { formatDate, formatMoney } from '@/lib/money';
import type { BillWithLines, Profile } from '@/types';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, '<br/>');
}

function fmtQty(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Number(q.toFixed(3)));
}

/** Self-contained HTML (no external assets) rendered to PDF by expo-print. */
export function billToHtml(bill: BillWithLines, profile: Profile): string {
  const money = (m: number) => esc(formatMoney(m, profile.currency));

  const rows = bill.lines
    .map(
      (l, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(l.description)}</td>
        <td class="r">${fmtQty(l.qty)}${l.unit ? ' ' + esc(l.unit) : ''}</td>
        <td class="r">${money(l.unit_price_minor)}</td>
        <td class="r">${money(l.line_total_minor)}</td>
      </tr>`,
    )
    .join('');

  const logo = profile.logo_uri?.startsWith('data:')
    ? `<img class="logo" src="${profile.logo_uri}" />`
    : '';

  const customer =
    bill.customer_name || bill.customer_phone
      ? `<div class="label">Bill to</div>
         <div class="strong">${esc(bill.customer_name)}</div>
         ${bill.customer_phone ? `<div>${esc(bill.customer_phone)}</div>` : ''}`
      : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
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
  .totals { margin-left: auto; width: 260px; margin-top: 16px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .grand { border-top: 2px solid #111; margin-top: 4px; padding-top: 8px !important; font-size: 17px; font-weight: 700; }
  .notes { margin-top: 24px; padding: 12px; background: #F7F8FA; border-radius: 6px; }
  .thanks { text-align: center; margin-top: 40px; color: #60646C; }
</style></head>
<body>
  <div class="head">
    <div class="biz">
      ${logo}
      <div>
        <div class="biz-name">${esc(profile.business_name)}</div>
        ${profile.owner_name ? `<div>${esc(profile.owner_name)}</div>` : ''}
        ${profile.phone ? `<div class="muted">${esc(profile.phone)}</div>` : ''}
        ${profile.address ? `<div class="muted">${nl2br(profile.address)}</div>` : ''}
      </div>
    </div>
    <div class="title">
      <h1>BILL</h1>
      <div class="strong">${esc(bill.bill_no)}</div>
      <div class="muted">${esc(formatDate(bill.date))}</div>
    </div>
  </div>

  <div class="meta"><div>${customer}</div></div>

  <table>
    <thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${money(bill.subtotal_minor)}</span></div>
    ${bill.discount_minor > 0 ? `<div><span>Discount</span><span>-${money(bill.discount_minor)}</span></div>` : ''}
    <div class="grand"><span>Total</span><span>${money(bill.total_minor)}</span></div>
  </div>

  ${bill.notes ? `<div class="notes"><div class="label">Notes</div>${nl2br(bill.notes)}</div>` : ''}

  <div class="thanks">Thank you for your business!</div>
</body></html>`;
}
