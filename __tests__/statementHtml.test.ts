import { statementToHtml, statementTotals } from '@/lib/statementHtml';
import type { Bill, Client, Profile } from '@/types';

const profile: Profile = {
  business_name: 'Shree Transport',
  owner_name: '',
  phone: '',
  address: '',
  logo_uri: null,
  currency: '₹',
  bill_prefix: 'TR-',
  upi_id: 'shree@okhdfc',
  trade: 'transport',
  language: 'en',
  bill_language: 'en',
  next_bill_no: 4,
  last_backup_at: null,
  app_lock: 0,
  bill_theme: 'classic',
  bill_accent: 'blue',
};
const client: Client = { id: 1, name: 'ABC <Logistics>', phone: '9876543210', address: 'MIDC\nPune' };

const bill = (no: string, total: number, status: Bill['status'], extra: Partial<Bill> = {}): Bill => ({
  id: 1,
  bill_no: no,
  customer_name: client.name,
  customer_phone: client.phone,
  date: '2026-10-31',
  discount_minor: 0,
  notes: '',
  subtotal_minor: total,
  total_minor: total,
  status,
  paid_minor: status === 'paid' ? total : 0,
  due_date: null,
  last_reminded_at: null,
  paid_at: null,
  client_id: 1,
  customer_address: client.address,
  period_start: null,
  period_end: null,
  detail_fields: [],
  created_at: '',
  ...extra,
});

const bills = [
  bill('TR-0001', 500000, 'paid', { date: '2026-08-31', period_start: '2026-08-01', period_end: '2026-08-31' }),
  bill('TR-0002', 750000, 'unpaid', { date: '2026-09-30', period_start: '2026-09-01', period_end: '2026-09-30' }),
  bill('TR-0003', 25000, 'unpaid', { date: '2026-10-05' }),
];

describe('statementTotals', () => {
  it('splits billed into paid and outstanding', () => {
    expect(statementTotals(bills)).toEqual({ billed_minor: 1275000, paid_minor: 500000, outstanding_minor: 775000 });
  });
});

describe('statementToHtml', () => {
  const html = statementToHtml({
    profile,
    client,
    period: { start: '2026-04-01', end: '2027-03-31' },
    bills,
    unbilled: { count: 3, total_minor: 150000 },
    today: '2026-10-14',
  });

  it('lists bills with their periods and status', () => {
    expect(html).toContain('STATEMENT');
    expect(html).toContain('FY 2026-27');
    expect(html).toContain('Issued 14 Oct 2026');
    expect(html).toContain('TR-0002');
    expect(html).toContain('September 2026');
    expect(html).toContain('>Paid<');
    expect(html).toContain('>Unpaid<');
  });

  it('shows totals, unbilled work and a QR for what is outstanding', () => {
    expect(html).toContain('₹12,750.00');
    expect(html).toContain('₹7,750.00');
    expect(html).toContain('3 entries worth ₹1,500.00');
    expect(html).toContain('Scan to pay');
  });

  it('escapes client details', () => {
    expect(html).toContain('ABC &lt;Logistics&gt;');
    expect(html).toContain('MIDC<br/>Pune');
  });

  it('drops the QR when everything is paid', () => {
    const settled = statementToHtml({
      profile,
      client,
      period: { start: '2026-04-01', end: '2027-03-31' },
      bills: [bills[0]],
      unbilled: { count: 0, total_minor: 0 },
    });
    expect(settled).not.toContain('Scan to pay');
    expect(settled).not.toContain('Not yet billed');
  });
});
