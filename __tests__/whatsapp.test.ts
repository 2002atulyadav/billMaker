import { billMessage, waPhone, whatsappUrl } from '@/lib/whatsapp';
import type { Bill, Profile } from '@/types';

describe('waPhone', () => {
  it.each([
    ['98765 43210', '919876543210'],
    ['098765-43210', '919876543210'],
    ['+91 98765 43210', '919876543210'],
    ['919876543210', '919876543210'],
    ['+1 (415) 555-0100', '14155550100'],
  ])('%p -> %p', (input, expected) => {
    expect(waPhone(input)).toBe(expected);
  });
  it.each(['', '12345', '98765432', '+12'])('rejects %p', (input) => {
    expect(waPhone(input)).toBeNull();
  });
});

const profile: Profile = {
  business_name: 'Ravi Taxi',
  owner_name: '',
  phone: '',
  address: '',
  logo_uri: null,
  currency: '₹',
  bill_prefix: 'TX-',
  upi_id: 'ravi@okhdfc',
  trade: 'taxi',
  language: 'en',
  bill_language: 'en',
  next_bill_no: 2,
};

const bill: Bill = {
  id: 1,
  bill_no: 'TX-0001',
  customer_name: 'Asha',
  customer_phone: '9876543210',
  date: '2026-10-11',
  discount_minor: 0,
  notes: '',
  subtotal_minor: 27000,
  total_minor: 27000,
  status: 'unpaid',
  paid_at: null,
  client_id: null,
  customer_address: '',
  period_start: null,
  period_end: null,
  detail_fields: [],
  created_at: '2026-10-11 10:00:00',
};

describe('billMessage', () => {
  it('asks for payment with the UPI ID when unpaid', () => {
    expect(billMessage(bill, profile)).toBe(
      'Hi Asha,\nBill TX-0001 from Ravi Taxi dated 11 Oct 2026.\nAmount due: ₹270.00\nPay by UPI: ravi@okhdfc',
    );
  });
  it('thanks instead of asking when paid', () => {
    const msg = billMessage({ ...bill, status: 'paid' }, profile);
    expect(msg).toContain('Paid. Thank you!');
    expect(msg).not.toContain('UPI');
  });
  it('mentions the billing period on period bills', () => {
    expect(billMessage({ ...bill, period_start: '2026-10-01', period_end: '2026-10-31', date: '2026-10-31' }, profile)).toContain(
      'Bill TX-0001 from Ravi Taxi for October 2026 (31 Oct 2026).',
    );
  });

  it('skips the UPI line when no UPI ID is set', () => {
    expect(billMessage(bill, { ...profile, upi_id: '' })).not.toContain('UPI');
  });
});

describe('whatsappUrl', () => {
  it('encodes the message', () => {
    expect(whatsappUrl('919876543210', 'Hi & bye\n₹1')).toBe(
      'https://wa.me/919876543210?text=Hi%20%26%20bye%0A%E2%82%B91',
    );
  });
});
