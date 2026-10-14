import { billableEntries, cleanDetails, detailsText, groupByMonth, periodBillDraft, sumEntries } from '@/lib/entries';
import { presetFor } from '@/lib/presets';
import type { Client, Entry } from '@/types';

const fields = presetFor('transport').entryFields;

let nextId = 1;
const entry = (date: string, qty: number, rate: number, extra: Partial<Entry> = {}): Entry => ({
  id: nextId++,
  client_id: 1,
  date,
  description: 'Trip charge',
  qty,
  unit: 'trip',
  unit_price_minor: rate,
  details: {},
  bill_id: null,
  bill_no: null,
  ...extra,
});

const client: Client = { id: 1, name: 'ABC Logistics Pvt Ltd', phone: '9876543210', address: 'MIDC, Pune' };

describe('sumEntries', () => {
  it('rounds each line like bill lines do', () => {
    expect(sumEntries([entry('2026-10-01', 12.4, 1500), entry('2026-10-02', 1, 500000)])).toEqual({
      count: 2,
      total_minor: 18600 + 500000,
    });
  });
});

describe('billableEntries', () => {
  const es = [
    entry('2026-10-20', 1, 100),
    entry('2026-10-03', 1, 100),
    entry('2026-10-03', 1, 100),
    entry('2026-09-30', 1, 100),
    entry('2026-10-10', 1, 100, { bill_id: 7, bill_no: 'TR-0007' }),
  ];
  it('keeps unbilled entries in the period, oldest first, stable by id', () => {
    const got = billableEntries(es, { start: '2026-10-01', end: '2026-10-31' });
    expect(got.map((e) => e.date)).toEqual(['2026-10-03', '2026-10-03', '2026-10-20']);
    expect(got[0].id).toBeLessThan(got[1].id);
  });
});

describe('groupByMonth', () => {
  it('groups newest month first with unbilled totals', () => {
    const groups = groupByMonth([
      entry('2026-09-05', 1, 1000),
      entry('2026-10-01', 2, 1000),
      entry('2026-10-09', 1, 1000, { bill_id: 3, bill_no: 'TR-0003' }),
    ]);
    expect(groups.map((g) => [g.key, g.entries.length, g.unbilled_minor])).toEqual([
      ['2026-10', 2, 2000],
      ['2026-09', 1, 1000],
    ]);
    expect(groups[0].entries[0].date).toBe('2026-10-09');
  });
});

describe('detailsText', () => {
  it('joins route with an arrow and other fields with a dot', () => {
    expect(detailsText(fields, { from: 'Pune', to: 'Mumbai', vehicle: 'MH12 AB 1234' })).toBe('Pune → Mumbai · MH12 AB 1234');
  });
  it('handles partial routes and missing values', () => {
    expect(detailsText(fields, { to: 'Mumbai' })).toBe('? → Mumbai');
    expect(detailsText(fields, { vehicle: 'MH12' })).toBe('MH12');
    expect(detailsText(fields, {})).toBe('');
  });
  it('ignores keys the trade does not define', () => {
    expect(detailsText(presetFor('repair').entryFields, { site: 'Flat 4B', from: 'x' })).toBe('Flat 4B');
  });
});

describe('cleanDetails', () => {
  it('trims, drops empties and unknown keys', () => {
    expect(cleanDetails(fields, { from: ' Pune ', to: '', junk: 'x' })).toEqual({ from: 'Pune' });
  });
});

describe('periodBillDraft', () => {
  const es = [
    entry('2026-10-01', 1, 500000, { details: { from: 'Pune', to: 'Mumbai', vehicle: '' } }),
    entry('2026-10-02', 2, 500000, { details: { from: 'Mumbai', to: 'Nashik' } }),
  ];
  const draft = periodBillDraft({
    client,
    entries: es,
    period: { start: '2026-10-01', end: '2026-10-31' },
    fields,
    date: '2026-10-31',
  });

  it('bills the client for the period with one dated line per entry', () => {
    expect(draft).toMatchObject({
      customer_name: 'ABC Logistics Pvt Ltd',
      customer_address: 'MIDC, Pune',
      client_id: 1,
      period_start: '2026-10-01',
      period_end: '2026-10-31',
      date: '2026-10-31',
    });
    expect(draft.lines.map((l) => [l.entry_date, l.qty, l.unit_price_minor])).toEqual([
      ['2026-10-01', 1, 500000],
      ['2026-10-02', 2, 500000],
    ]);
  });

  it('only keeps detail columns that some entry filled', () => {
    expect(draft.detail_fields?.map((f) => f.key)).toEqual(['from', 'to']);
    expect(draft.lines[0].details).toEqual({ from: 'Pune', to: 'Mumbai' });
  });
});
