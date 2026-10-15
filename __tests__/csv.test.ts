import { makeBillTranslator } from '@/i18n';
import { billLinesCsv, billsCsv, csvFileName, toCsv } from '@/lib/csv';
import type { BillWithLines } from '@/types';

const bill: BillWithLines = {
  id: 1,
  bill_no: 'TR-0001',
  customer_name: 'Acme, "Pune"',
  customer_phone: '+91 98765 43210',
  date: '2026-10-01',
  discount_minor: 5000,
  notes: 'line1\nline2',
  subtotal_minor: 1005000,
  total_minor: 1000000,
  status: 'paid',
  paid_at: '2026-10-05 08:00:00',
  client_id: 1,
  customer_address: '',
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  detail_fields: [
    { key: 'from', label: 'From' },
    { key: 'to', label: 'To' },
  ],
  created_at: '2026-10-01 08:00:00',
  lines: [
    {
      description: 'Trip',
      qty: 2,
      unit: 'trip',
      unit_price_minor: 500000,
      line_total_minor: 1000000,
      entry_date: '2026-09-03',
      details: { to: 'Mumbai', from: 'Pune' },
    },
    { description: 'Toll', qty: 1.5, unit: 'other', unit_price_minor: 3333, line_total_minor: 5000, entry_date: null, details: {} },
  ],
};

describe('toCsv', () => {
  it('quotes, escapes and adds a BOM for Excel', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', 'x\ny', 3, null]])).toBe('﻿a,"b,c","say ""hi""","x\ny",3,\r\n');
  });

  it('defuses spreadsheet formulas in text', () => {
    expect(toCsv([['=HYPERLINK("x")', '+91 1', '-5', '@a', 'ok']])).toBe(
      '﻿"\'=HYPERLINK(""x"")",\'+91 1,\'-5,\'@a,ok\r\n',
    );
  });
});

describe('bill exports', () => {
  const en = makeBillTranslator('en');

  it('writes one row per bill with decimal amounts', () => {
    const rows = billsCsv([bill], en.t).replace('﻿', '').trim().split('\r\n');
    expect(rows[0]).toBe('Bill no.,Date,Customer,Phone,Subtotal,Discount,Total,Status,Paid on,Notes');
    expect(rows.slice(1).join('\r\n')).toBe(
      'TR-0001,2026-10-01,"Acme, ""Pune""",\'+91 98765 43210,10050.00,50.00,10000.00,Paid,2026-10-05,"line1\nline2"',
    );
  });

  it('writes one row per line with work date and details in column order', () => {
    const rows = billLinesCsv([bill], en.t, en.unit).replace('﻿', '').trim().split('\r\n');
    expect(rows[0]).toBe('Bill no.,Date,Customer,Item,Work date,Qty,Unit,Rate,Amount,Details');
    expect(rows[1]).toBe('TR-0001,2026-10-01,"Acme, ""Pune""",Trip,2026-09-03,2,trip,5000.00,10000.00,Pune · Mumbai');
    expect(rows[2]).toBe('TR-0001,2026-10-01,"Acme, ""Pune""",Toll,,1.5,other,33.33,50.00,');
  });

  it('uses the bill language for headings', () => {
    const hi = makeBillTranslator('hi');
    expect(billsCsv([bill], hi.t)).toContain('बिल नंबर,तारीख़,ग्राहक');
    expect(billsCsv([bill], hi.t)).toContain(',भुगतान हुआ,');
    expect(billLinesCsv([bill], hi.t, hi.unit)).toContain(',ट्रिप,');
    expect(billsCsv([bill], makeBillTranslator('both').t)).toContain('Total / कुल');
  });

  it('names files by period', () => {
    expect(csvFileName('Bills', '2026-04-01', '2027-03-31')).toBe('Bills-2026-04-01-to-2027-03-31.csv');
    expect(csvFileName('Bill-items', null, null)).toBe('Bill-items-all.csv');
  });
});
