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
  created_at: '2026-10-11 10:00:00',
  lines: [
    { description: 'Per km fare', qty: 12.4, unit: 'km', unit_price_minor: 1500, line_total_minor: 18600 },
    { description: 'Waiting <1hr>', qty: 1, unit: 'hr', unit_price_minor: 9000, line_total_minor: 9000 },
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
});
