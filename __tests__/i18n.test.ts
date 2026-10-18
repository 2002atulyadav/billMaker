import * as Localization from 'expo-localization';

import { deviceLang, makeBillTranslator, makeTranslator, translate, translateCount } from '@/i18n';
import { billToHtml } from '@/lib/billHtml';
import { formatDate } from '@/lib/money';
import { formatPeriod } from '@/lib/period';
import { PRESETS, presetItemName } from '@/lib/presets';
import { billMessage } from '@/lib/whatsapp';
import type { BillWithLines, Profile } from '@/types';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

describe('translate', () => {
  it('fills {{vars}} and leaves unknown placeholders alone', () => {
    expect(translate('en', 'numbering.saved', { billNo: 'INV-0007' })).toBe('Your next bill will be INV-0007.');
    expect(translate('en', 'numbering.saved')).toBe('Your next bill will be {{billNo}}.');
  });

  it('switches language', () => {
    expect(translate('hi', 'nav.bills')).toBe('बिल');
  });

  it('picks singular/plural forms and fills count', () => {
    expect(translateCount('en', 'common.entries', 1)).toBe('1 entry');
    expect(translateCount('en', 'common.entries', 3)).toBe('3 entries');
    expect(translateCount('hi', 'trade.added', 2)).toBe('2 शुरुआती सामान जोड़े गए।');
  });
});

describe('translators', () => {
  it('translates units and runtime keys with a fallback', () => {
    const hi = makeTranslator('hi');
    expect(hi.unit('pcs')).toBe('नग');
    expect(hi.unit('bogus')).toBe('bogus');
    expect(hi.unit('')).toBe('');
    expect(hi.dyn('field.vehicle', 'Vehicle no.')).toBe('गाड़ी नंबर');
    expect(hi.dyn('field.unknown', 'Fallback')).toBe('Fallback');
  });

  it('"both" joins English and Hindi, without doubling identical text', () => {
    const both = makeBillTranslator('both');
    expect(both.t('pdf.total')).toBe('Total / कुल');
    expect(both.t('pdf.upiId')).toBe('UPI ID');
    expect(both.unit('kg')).toBe('kg / किलो');
    expect(both.lang).toBe('en');
  });
});

describe('deviceLang', () => {
  const getLocales = Localization.getLocales as jest.Mock;
  it('uses the first supported device language', () => {
    getLocales.mockReturnValue([{ languageCode: 'fr' }, { languageCode: 'hi' }]);
    expect(deviceLang()).toBe('hi');
  });
  it('falls back to English', () => {
    getLocales.mockReturnValue([{ languageCode: 'ta' }]);
    expect(deviceLang()).toBe('en');
  });
});

describe('localized dates', () => {
  it('formats Hindi month names', () => {
    expect(formatDate('2026-10-14', 'hi')).toBe('14 अक्टू 2026');
    expect(formatPeriod({ start: '2026-10-01', end: '2026-10-31' }, 'hi')).toBe('अक्टूबर 2026');
    expect(formatPeriod({ start: '2026-04-01', end: '2027-03-31' }, 'hi')).toBe('वित्त वर्ष 2026-27');
  });
});

describe('presets', () => {
  it('has a Hindi name for every starter item', () => {
    for (const p of PRESETS) for (const i of p.items) expect(presetItemName(i, 'hi')).toMatch(/[ऀ-ॿ]/);
    expect(presetItemName(PRESETS[0].items[0], 'en')).toBe('Trip charge');
  });
});

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
  language: 'hi',
  bill_language: 'hi',
  next_bill_no: 2,
  last_backup_at: null,
  app_lock: 0,
  bill_theme: 'classic',
  bill_accent: 'blue',
};

const bill: BillWithLines = {
  id: 1,
  bill_no: 'TR-0001',
  customer_name: 'ABC Logistics',
  customer_phone: '9876543210',
  date: '2026-10-31',
  discount_minor: 0,
  notes: '',
  subtotal_minor: 1000000,
  total_minor: 1000000,
  status: 'unpaid',
  paid_minor: 0,
  due_date: null,
  last_reminded_at: null,
  paid_at: null,
  client_id: 1,
  customer_address: '',
  period_start: '2026-10-01',
  period_end: '2026-10-31',
  detail_fields: [{ key: 'vehicle', label: 'Vehicle no.' }],
  created_at: '',
  payments: [],
  lines: [
    {
      description: 'ट्रिप चार्ज',
      qty: 2,
      unit: 'trip',
      unit_price_minor: 500000,
      line_total_minor: 1000000,
      entry_date: '2026-10-03',
      details: { vehicle: 'MH12' },
    },
  ],
};

describe('bills in other languages', () => {
  it('prints Hindi labels, months, units and trade columns', () => {
    const html = billToHtml(bill, profile);
    expect(html).toContain('<html lang="hi">');
    for (const s of ['<h1>बिल</h1>', 'बिल की अवधि', 'अक्टूबर 2026', '3 अक्टू 2026', '2 ट्रिप', '<th>गाड़ी नंबर</th>', 'कुल', 'धन्यवाद!']) {
      expect(html).toContain(s);
    }
    expect(html).not.toContain('Total');
  });

  it('prints bilingual labels with English dates when set to both', () => {
    const html = billToHtml(bill, { ...profile, bill_language: 'both' });
    expect(html).toContain('Total / कुल');
    expect(html).toContain('<th>Vehicle no. / गाड़ी नंबर</th>');
    expect(html).toContain('October 2026');
  });

  it('writes the WhatsApp message in Hindi for Hindi bills, English otherwise', () => {
    expect(billMessage(bill, profile)).toBe(
      'नमस्ते ABC Logistics जी,\nShree Transport की ओर से अक्टूबर 2026 का बिल TR-0001 (31 अक्टू 2026)।\nबाकी रकम: ₹10,000.00\nUPI से भुगतान करें: shree@okhdfc',
    );
    expect(billMessage(bill, { ...profile, bill_language: 'both' })).toContain('Amount due: ₹10,000.00');
  });
});
