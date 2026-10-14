import { billToHtml } from '@/lib/billHtml';
import type { BillWithLines, Profile } from '@/types';

const profile: Profile = {
  business_name: 'Ravi <Taxi> & Tours',
  owner_name: 'Ravi',
  phone: '98765 43210',
  address: 'MG Road\nBengaluru',
  logo_uri: null,
  currency: '₹',
  bill_prefix: 'TX-',
  upi_id: '',
  trade: 'taxi',
  next_bill_no: 2,
};

const bill: BillWithLines = {
  id: 1,
  bill_no: 'TX-0001',
  customer_name: 'Asha',
  customer_phone: '',
  date: '2026-10-11',
  discount_minor: 600,
  notes: 'Paid via UPI',
  subtotal_minor: 27600,
  total_minor: 27000,
  status: 'unpaid',
  paid_at: null,
  client_id: null,
  customer_address: '',
  period_start: null,
  period_end: null,
  detail_fields: [],
  created_at: '2026-10-11 10:00:00',
  lines: [
    { description: 'Per km fare', qty: 12.4, unit: 'km', unit_price_minor: 1500, line_total_minor: 18600, entry_date: null, details: {} },
    { description: 'Waiting <1hr>', qty: 1, unit: 'hr', unit_price_minor: 9000, line_total_minor: 9000, entry_date: null, details: {} },
  ],
};

describe('billToHtml', () => {
  const html = billToHtml(bill, profile);

  it('escapes user-entered text', () => {
    expect(html).toContain('Ravi &lt;Taxi&gt; &amp; Tours');
    expect(html).toContain('Waiting &lt;1hr&gt;');
    expect(html).not.toContain('<Taxi>');
  });

  it('includes bill number, formatted date, lines and totals', () => {
    expect(html).toContain('TX-0001');
    expect(html).toContain('11 Oct 2026');
    expect(html).toContain('12.4 km');
    expect(html).toContain('₹186.00');
    expect(html).toContain('-₹6.00');
    expect(html).toContain('₹270.00');
    expect(html).toContain('MG Road<br/>Bengaluru');
  });

  it('omits the discount row when there is no discount', () => {
    const noDiscount = billToHtml({ ...bill, discount_minor: 0 }, profile);
    expect(noDiscount).not.toContain('Discount');
  });

  it('only embeds data: URI logos', () => {
    expect(billToHtml(bill, { ...profile, logo_uri: 'file:///x.png' })).not.toContain('<img');
    expect(billToHtml(bill, { ...profile, logo_uri: 'data:image/png;base64,AAA' })).toContain('<img');
  });

  it('shows a UPI QR for unpaid bills when a UPI ID is set', () => {
    const withUpi = billToHtml(bill, { ...profile, upi_id: 'ravi@okhdfc' });
    expect(withUpi).toContain('Scan to pay');
    expect(withUpi).toContain('<svg');
    expect(withUpi).toContain('UPI ID: ravi@okhdfc');
    expect(html).not.toContain('Scan to pay');
  });

  it('stamps paid bills and drops the pay block', () => {
    const paid = billToHtml({ ...bill, status: 'paid', paid_at: '2026-10-12 09:00:00' }, { ...profile, upi_id: 'ravi@okhdfc' });
    expect(paid).toContain('class="stamp">PAID');
    expect(paid).not.toContain('Scan to pay');
    expect(html).not.toContain('class="stamp"');
  });

  it('prints address, period, dates and trade columns on period bills', () => {
    const period = billToHtml(
      {
        ...bill,
        customer_address: 'MIDC\nPune',
        period_start: '2026-10-01',
        period_end: '2026-10-31',
        detail_fields: [
          { key: 'from', label: 'From' },
          { key: 'vehicle', label: 'Vehicle no.' },
        ],
        lines: [
          { ...bill.lines[0], entry_date: '2026-10-03', details: { from: 'Pune', vehicle: 'MH12 <AB>' } },
          { ...bill.lines[1], entry_date: '2026-10-04', details: {} },
        ],
      },
      profile,
    );
    expect(period).toContain('MIDC<br/>Pune');
    expect(period).toContain('Billing period');
    expect(period).toContain('October 2026');
    expect(period).toContain('<th>Date</th>');
    expect(period).toContain('<th>From</th><th>Vehicle no.</th>');
    expect(period).toContain('3 Oct 2026');
    expect(period).toContain('MH12 &lt;AB&gt;');
  });

  it('keeps the simple layout for ordinary bills', () => {
    expect(html).not.toContain('<th>Date</th>');
    expect(html).not.toContain('Billing period');
  });
});
