import { PRESETS, presetFor } from '@/lib/presets';
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
});
