import { makeBillTranslator, type Translator } from '@/i18n';
import { businessHead, esc, nl2br, payBlock, themeCss } from '@/lib/billHtml';
import { profileTheme } from '@/lib/billTheme';
import { formatDate, formatMoney, todayISO } from '@/lib/money';
import { formatPeriod, type Period } from '@/lib/period';
import type { Bill, Client, Profile } from '@/types';

export type StatementTotals = { billed_minor: number; paid_minor: number; outstanding_minor: number };

/** Part payments count: "paid" is money received, "outstanding" what's still due. */
export function statementTotals(bills: Pick<Bill, 'total_minor' | 'paid_minor'>[]): StatementTotals {
  let billed = 0;
  let paid = 0;
  for (const b of bills) {
    billed += b.total_minor;
    paid += Math.min(b.paid_minor, b.total_minor);
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
  /** defaults to the profile's bill language */
  tr?: Translator;
}): string {
  const { profile, client, period, bills, unbilled } = opts;
  const tr = opts.tr ?? makeBillTranslator(profile.bill_language);
  const money = (m: number) => esc(formatMoney(m, profile.currency));
  const date = (iso: string) => esc(formatDate(iso, tr.lang));
  const periodLabel = (p: Period) => esc(formatPeriod(p, tr.lang));
  const t = statementTotals(bills);

  const rows = bills.length
    ? bills
        .map(
          (b) => `
      <tr>
        <td class="nowrap">${date(b.date)}</td>
        <td>${esc(b.bill_no)}</td>
        <td>${b.period_start && b.period_end ? periodLabel({ start: b.period_start, end: b.period_end }) : ''}</td>
        <td class="r">${money(b.total_minor)}</td>
        <td class="r ${b.status === 'paid' ? 'ok' : 'due'}">${esc(
          tr.t(b.status === 'paid' ? 'pdf.statusPaid' : b.status === 'partial' ? 'pdf.statusPartial' : 'pdf.statusUnpaid'),
        )}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="5" class="muted">${esc(tr.t('pdf.noBills'))}</td></tr>`;

  return `<!doctype html>
<html lang="${tr.lang}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
${themeCss(profileTheme(profile))}
  .ok { color: #1A7F37; font-weight: 600; }
  .due { color: #9A6700; font-weight: 600; }
</style></head>
<body><div class="page">
  ${businessHead(profile, `
      <h1>${esc(tr.t('pdf.statement'))}</h1>
      <div class="strong">${periodLabel(period)}</div>
      <div class="muted">${esc(tr.t('pdf.issued', { date: formatDate(opts.today ?? todayISO(), tr.lang) }))}</div>`)}

  <div class="meta">
    <div>
      <div class="label">${esc(tr.t('pdf.statementFor'))}</div>
      <div class="strong">${esc(client.name)}</div>
      ${client.address ? `<div class="muted">${nl2br(client.address)}</div>` : ''}
      ${client.phone ? `<div>${esc(client.phone)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr><th>${esc(tr.t('pdf.date'))}</th><th>${esc(tr.t('pdf.billNo'))}</th><th>${esc(
      tr.t('pdf.forPeriod'),
    )}</th><th class="r">${esc(tr.t('pdf.amount'))}</th><th class="r">${esc(tr.t('pdf.status'))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>${esc(tr.t('pdf.totalBilled'))}</span><span>${money(t.billed_minor)}</span></div>
    <div><span>${esc(tr.t('pdf.statusPaid'))}</span><span>${money(t.paid_minor)}</span></div>
    <div class="grand"><span>${esc(tr.t('pdf.outstanding'))}</span><span>${money(t.outstanding_minor)}</span></div>
  </div>

  ${
    unbilled.count > 0
      ? `<div class="notes"><div class="label">${esc(tr.t('pdf.notYetBilled'))}</div>${esc(
          tr.tn('pdf.notYetBilledText', unbilled.count, { amount: formatMoney(unbilled.total_minor, profile.currency) }),
        )}</div>`
      : ''
  }

  ${payBlock(profile, t.outstanding_minor, `${client.name} statement`.slice(0, 50), tr)}

  <div class="thanks">${esc(tr.t('pdf.thanks'))}</div>
</div></body></html>`;
}
