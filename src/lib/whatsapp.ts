import { makeTranslator } from '@/i18n';
import { balanceOf } from '@/lib/due';
import { formatDate, formatMoney } from '@/lib/money';
import { formatPeriod } from '@/lib/period';
import type { Bill, Client, Profile } from '@/types';

/**
 * Normalizes a typed phone number to the international digits wa.me expects.
 * Bare 10-digit numbers (and 0-prefixed ones) are treated as Indian mobiles.
 * Returns null when it can't be a valid number.
 */
export function waPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? digits : null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

/**
 * Short text bill for WhatsApp: who, what, how much, and how to pay. Written in Hindi when bills are
 * in Hindi; a bilingual chat message would be too long, so "both" uses English.
 */
export function billMessage(bill: Bill, profile: Profile): string {
  const lang = profile.bill_language === 'hi' ? 'hi' : 'en';
  const { t } = makeTranslator(lang);
  // Once part-paid, the customer is told what's left, not the original total.
  const total = formatMoney(bill.status === 'paid' ? bill.total_minor : balanceOf(bill), profile.currency);
  const vars = { billNo: bill.bill_no, business: profile.business_name, date: formatDate(bill.date, lang) };
  const lines = [
    bill.customer_name ? t('wa.hiName', { name: bill.customer_name }) : t('wa.hi'),
    bill.period_start && bill.period_end
      ? t('wa.billPeriod', { ...vars, period: formatPeriod({ start: bill.period_start, end: bill.period_end }, lang) })
      : t('wa.billDated', vars),
    bill.status === 'paid' ? t('wa.paid', { total }) : t('wa.due', { total }),
  ];
  if (bill.status !== 'paid' && profile.upi_id) lines.push(t('wa.upi', { upi: profile.upi_id }));
  return lines.join('\n');
}

const chatLang = (profile: Profile) => (profile.bill_language === 'hi' ? 'hi' : 'en');

/** Polite follow-up for one unpaid bill: what's pending, the due date, and how to pay. */
export function reminderMessage(bill: Bill, profile: Profile): string {
  const lang = chatLang(profile);
  const { t } = makeTranslator(lang);
  const lines = [
    bill.customer_name ? t('wa.hiName', { name: bill.customer_name }) : t('wa.hi'),
    t('wa.reminderIntro', { billNo: bill.bill_no, business: profile.business_name, date: formatDate(bill.date, lang) }),
    t('wa.reminderPending', { amount: formatMoney(balanceOf(bill), profile.currency) }),
  ];
  if (bill.due_date) lines.push(t('wa.reminderDueDate', { date: formatDate(bill.due_date, lang) }));
  if (profile.upi_id) lines.push(t('wa.upi', { upi: profile.upi_id }));
  lines.push(t('wa.reminderThanks'));
  return lines.join('\n');
}

/** One reminder covering all of a client's unpaid bills. */
export function clientReminderMessage(client: Client, bills: Bill[], profile: Profile): string {
  const lang = chatLang(profile);
  const { t, tn } = makeTranslator(lang);
  const due = bills.filter((b) => b.status !== 'paid');
  const total = due.reduce((s, b) => s + balanceOf(b), 0);
  const lines = [
    t('wa.hiName', { name: client.name }),
    tn('wa.reminderClient', due.length, { business: profile.business_name, amount: formatMoney(total, profile.currency) }),
    ...due.map((b) =>
      t('wa.reminderBillLine', { billNo: b.bill_no, date: formatDate(b.date, lang), amount: formatMoney(balanceOf(b), profile.currency) }),
    ),
  ];
  if (profile.upi_id) lines.push(t('wa.upi', { upi: profile.upi_id }));
  lines.push(t('wa.reminderThanks'));
  return lines.join('\n');
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
