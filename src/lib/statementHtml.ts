import { BASE_CSS, businessHead, esc, nl2br, payBlock } from '@/lib/billHtml';
import { formatDate, formatMoney, todayISO } from '@/lib/money';
import { formatPeriod, type Period } from '@/lib/period';
import type { Bill, Client, Profile } from '@/types';

export type StatementTotals = { billed_minor: number; paid_minor: number; outstanding_minor: number };

export function statementTotals(bills: Pick<Bill, 'total_minor' | 'status'>[]): StatementTotals {
  let billed = 0;
  let paid = 0;
  for (const b of bills) {
    billed += b.total_minor;
    if (b.status === 'paid') paid += b.total_minor;
  }
  return { billed_minor: billed, paid_minor: paid, outstanding_minor: billed - paid };
}

/**
 * Statement of account: every bill sent to a client in the period with its status, plus what's still
 * owed and any work logged but not billed yet.
 */
export function statementToHtml(opts: {
  profile: Profile;
  client: Client;
  period: Period;
  bills: Bill[];
  unbilled: { count: number; total_minor: number };
  today?: string;
}): string {
  const { profile, client, period, bills, unbilled } = opts;
  const money = (m: number) => esc(formatMoney(m, profile.currency));
  const t = statementTotals(bills);

  const rows = bills.length
    ? bills
        .map(
          (b) => `
      <tr>
        <td class="nowrap">${esc(formatDate(b.date))}</td>
        <td>${esc(b.bill_no)}</td>
        <td>${b.period_start && b.period_end ? esc(formatPeriod({ start: b.period_start, end: b.period_end })) : ''}</td>
        <td class="r">${money(b.total_minor)}</td>
        <td class="r ${b.status === 'paid' ? 'ok' : 'due'}">${b.status === 'paid' ? 'Paid' : 'Unpaid'}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="5" class="muted">No bills in this period.</td></tr>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
${BASE_CSS}
  .ok { color: #1A7F37; font-weight: 600; }
  .due { color: #9A6700; font-weight: 600; }
</style></head>
<body>
  ${businessHead(profile, `
      <h1>STATEMENT</h1>
      <div class="strong">${esc(formatPeriod(period))}</div>
      <div class="muted">Issued ${esc(formatDate(opts.today ?? todayISO()))}</div>`)}

  <div class="meta">
    <div>
      <div class="label">Statement for</div>
      <div class="strong">${esc(client.name)}</div>
      ${client.address ? `<div class="muted">${nl2br(client.address)}</div>` : ''}
      ${client.phone ? `<div>${esc(client.phone)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr><th>Date</th><th>Bill no.</th><th>For period</th><th class="r">Amount</th><th class="r">Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Total billed</span><span>${money(t.billed_minor)}</span></div>
    <div><span>Paid</span><span>${money(t.paid_minor)}</span></div>
    <div class="grand"><span>Outstanding</span><span>${money(t.outstanding_minor)}</span></div>
  </div>

  ${
    unbilled.count > 0
      ? `<div class="notes"><div class="label">Not yet billed</div>${unbilled.count} ${
          unbilled.count === 1 ? 'entry' : 'entries'
        } worth ${money(unbilled.total_minor)} will appear on your next bill.</div>`
      : ''
  }

  ${payBlock(profile, t.outstanding_minor, `${client.name} statement`.slice(0, 50))}

  <div class="thanks">Thank you for your business!</div>
</body></html>`;
}
