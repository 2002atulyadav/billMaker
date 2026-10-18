import { amountWords, billToHtml } from '@/lib/billHtml';
import { ACCENTS, ACCENT_IDS, BILL_THEMES, sampleBill, themeTokens, tint } from '@/lib/billTheme';
import { statementToHtml } from '@/lib/statementHtml';
import type { Profile } from '@/types';

const profile: Profile = {
  business_name: 'Sharma Transport', owner_name: '', phone: '98765', address: 'Pune', logo_uri: null, currency: '₹',
  bill_prefix: 'TR-', upi_id: 'ravi@okhdfc', trade: 'transport', language: 'en', bill_language: 'en',
  next_bill_no: 2, last_backup_at: null, app_lock: 0, bill_theme: 'classic', bill_accent: 'blue',
};

describe('themeTokens', () => {
  it('covers every theme and accent', () => {
    for (const th of BILL_THEMES) {
      for (const a of ACCENT_IDS) {
        const tk = themeTokens(th, a);
        expect(tk.theme).toBe(th);
        expect(tk.accent).toBe(th === 'receipt' ? ACCENTS.black : ACCENTS[a]);
      }
    }
  });

  it('gives each theme its look', () => {
    expect(themeTokens('classic', 'blue')).toMatchObject({ headerStyle: 'line', tableStyle: 'rows', amountInWords: false });
    expect(themeTokens('bold', 'green')).toMatchObject({ headerStyle: 'band', tableStyle: 'tinted', accent: ACCENTS.green });
    expect(themeTokens('bahi', 'maroon')).toMatchObject({ headerStyle: 'centred', tableStyle: 'grid', pageBorder: true, amountInWords: true, signature: true });
    expect(themeTokens('receipt', 'purple')).toMatchObject({ headerStyle: 'compact', mono: true, accent: ACCENTS.black });
  });

  it('falls back to Classic blue for unknown values', () => {
    expect(themeTokens('fancy', 'pink')).toMatchObject({ theme: 'classic', accent: ACCENTS.blue });
  });

  it('tints towards white', () => {
    expect(tint('#000000', 0.1)).toBe('#E6E6E6');
    expect(tint('#1F6FEB', 1)).toBe('#1F6FEB');
  });
});

describe('sampleBill', () => {
  it("uses the owner's trade items and prefix", () => {
    const b = sampleBill(profile, 'en', '2026-10-18');
    expect(b.bill_no).toBe('TR-0001');
    expect(b.lines.map((l) => l.description)).toEqual(['Trip charge', 'Per km', 'Per ton']);
    expect(b.total_minor).toBe(b.lines.reduce((s, l) => s + l.line_total_minor, 0));
    expect(b.due_date).toBe('2026-10-25');
  });

  it('has items for trades that start empty, in Hindi too', () => {
    const b = sampleBill({ ...profile, trade: 'shop' }, 'hi');
    expect(b.lines[0].description).toBe('चावल (5 किलो)');
    expect(b.customer_name).toBe('रमेश ट्रेडर्स');
  });
});

describe('billToHtml in each theme', () => {
  const bill = sampleBill(profile, 'en', '2026-10-18');
  const html = (theme: string, accent = 'blue', extra: Partial<Profile> = {}) =>
    billToHtml(bill, { ...profile, bill_theme: theme, bill_accent: accent, ...extra });

  it('colours the bill with the accent', () => {
    expect(html('classic', 'maroon')).toContain(`--accent: ${ACCENTS.maroon}`);
    expect(html('bold', 'green')).toContain(`--accent: ${ACCENTS.green}`);
    expect(html('receipt', 'green')).toContain(`--accent: ${ACCENTS.black}`);
  });

  it('adds the theme-specific styles', () => {
    expect(html('bold')).toContain('.head { background: var(--accent)');
    expect(html('bahi')).toContain('4px double var(--accent)');
    expect(html('receipt')).toContain('max-width: 380px');
    expect(html('classic')).not.toContain('max-width: 380px');
  });

  it('prints amount in words, M/s and a signature only on Traditional', () => {
    const bahi = html('bahi');
    expect(bahi).toContain('Amount in words');
    expect(bahi).toContain('rupees only');
    expect(bahi).toContain('M/s Ramesh Traders');
    expect(bahi).toContain('Authorised signature');
    for (const t of ['classic', 'bold', 'receipt']) {
      expect(html(t)).not.toContain('Amount in words');
      expect(html(t)).not.toContain('Authorised signature');
    }
  });

  it('keeps the payment QR in every theme', () => {
    for (const t of BILL_THEMES) {
      const h = html(t);
      expect(h).toContain('Scan to pay');
      expect(h).toContain('<svg');
    }
  });

  it('writes amount in words in the bill language', () => {
    expect(amountWords(1035000, { currency: '₹', bill_language: 'hi' })).toEqual(['दस हज़ार तीन सौ पचास रुपये मात्र']);
    expect(amountWords(1035000, { currency: '₹', bill_language: 'both' })).toHaveLength(2);
    expect(amountWords(1035000, { currency: '$', bill_language: 'en' })).toEqual([]);
  });

  it('themes the statement too', () => {
    const st = statementToHtml({
      profile: { ...profile, bill_theme: 'bold', bill_accent: 'purple' },
      client: { id: 1, name: 'Acme', phone: '', address: '' },
      period: { start: '2026-10-01', end: '2026-10-31' },
      bills: [bill],
      unbilled: { count: 0, total_minor: 0 },
    });
    expect(st).toContain(`--accent: ${ACCENTS.purple}`);
    expect(st).toContain('class="page"');
  });
});
