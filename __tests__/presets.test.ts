import { PRESETS, presetFor, unitsFor } from '@/lib/presets';
import { TRADES, UNITS } from '@/types';

describe('presets', () => {
  it('has exactly one preset per trade', () => {
    expect(PRESETS.map((p) => p.trade).sort()).toEqual([...TRADES].sort());
  });

  it('seeds only valid units and positive whole-paise rates', () => {
    for (const p of PRESETS) {
      for (const i of p.items) {
        expect(UNITS).toContain(i.unit);
        expect(Number.isInteger(i.price_minor) && i.price_minor > 0).toBe(true);
      }
      expect(new Set(p.items.map((i) => i.name)).size).toBe(p.items.length);
    }
  });

  it('looks up by trade', () => {
    expect(presetFor('taxi').billPrefix).toBe('TX-');
  });

  it('offers only valid units, always including "other", and seeds items in those units', () => {
    for (const p of PRESETS) {
      expect(p.units).toContain('other');
      for (const u of p.units) expect(UNITS).toContain(u);
      for (const i of p.items) expect(p.units).toContain(i.unit);
    }
  });

  it('has unique entry field keys per trade', () => {
    for (const p of PRESETS) expect(new Set(p.entryFields.map((f) => f.key)).size).toBe(p.entryFields.length);
  });

  it('transport has route and vehicle fields', () => {
    expect(presetFor('transport').entryFields.map((f) => f.key)).toEqual(['from', 'to', 'vehicle']);
  });
});

describe('unitsFor', () => {
  it('returns the trade units', () => {
    expect(unitsFor('shop')).toEqual(['pcs', 'kg', 'ltr', 'mtr', 'other']);
  });
  it('keeps an existing item unit visible after a trade change', () => {
    expect(unitsFor('shop', 'km')).toEqual(['pcs', 'kg', 'ltr', 'mtr', 'other', 'km']);
    expect(unitsFor('shop', 'kg')).toEqual(['pcs', 'kg', 'ltr', 'mtr', 'other']);
    expect(unitsFor('shop', 'bogus')).toEqual(['pcs', 'kg', 'ltr', 'mtr', 'other']);
  });
});
