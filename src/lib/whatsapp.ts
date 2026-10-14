import { makeTranslator } from '@/i18n';
import { formatDate, formatMoney } from '@/lib/money';
import { formatPeriod } from '@/lib/period';
import type { Bill, Profile } from '@/types';

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
  const total = formatMoney(bill.total_minor, profile.currency);
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

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
