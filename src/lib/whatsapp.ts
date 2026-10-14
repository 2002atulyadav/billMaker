import { formatDate, formatMoney } from '@/lib/money';
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

/** Short text bill for WhatsApp: who, what, how much, and how to pay. */
export function billMessage(bill: Bill, profile: Profile): string {
  const total = formatMoney(bill.total_minor, profile.currency);
  const lines = [
    bill.customer_name ? `Hi ${bill.customer_name},` : 'Hi,',
    `Bill ${bill.bill_no} from ${profile.business_name} dated ${formatDate(bill.date)}.`,
    bill.status === 'paid' ? `Total: ${total} — Paid. Thank you!` : `Amount due: ${total}`,
  ];
  if (bill.status !== 'paid' && profile.upi_id) lines.push(`Pay by UPI: ${profile.upi_id}`);
  return lines.join('\n');
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
