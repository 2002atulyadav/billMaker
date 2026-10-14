import {
  computeTotals,
  formatBillNo,
  formatDate,
  formatMoney,
  isoToDate,
  isValidISODate,
  lineTotal,
  minNextBillNo,
  minorToDecimal,
  minorToInput,
  parseAmount,
  parseQty,
  todayISO,
} from '@/lib/money';

describe('parseAmount', () => {
  it.each([
    ['120', 12000],
    ['15.5', 1550],
    ['15.50', 1550],
    ['0.05', 5],
    [' 7 ', 700],
    ['0', 0],
  ])('%s -> %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '1.234', '-5', '1,000', '.5'])('rejects %p', (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it('avoids float drift (0.29 * 100 = 28.999…)', () => {
    expect(parseAmount('0.29')).toBe(29);
    expect(parseAmount('1.15')).toBe(115);
  });
});

describe('parseQty', () => {
  it('accepts whole and fractional quantities', () => {
    expect(parseQty('3')).toBe(3);
    expect(parseQty('12.4')).toBe(12.4);
    expect(parseQty('0.125')).toBe(0.125);
  });
  it('rejects zero, empty and invalid', () => {
    expect(parseQty('0')).toBeNull();
    expect(parseQty('')).toBeNull();
    expect(parseQty('x')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('uses Indian digit grouping', () => {
    expect(formatMoney(0, '₹')).toBe('₹0.00');
    expect(formatMoney(99999, '₹')).toBe('₹999.99');
    expect(formatMoney(125000, '₹')).toBe('₹1,250.00');
    expect(formatMoney(12345678, '₹')).toBe('₹1,23,456.78');
    expect(formatMoney(1234567890, '$')).toBe('$1,23,45,678.90');
  });
  it('handles negatives', () => {
    expect(formatMoney(-150, '₹')).toBe('-₹1.50');
  });
});

describe('minorToDecimal', () => {
  it('always has two decimals and no grouping', () => {
    expect(minorToDecimal(125005)).toBe('1250.05');
    expect(minorToDecimal(27000)).toBe('270.00');
    expect(minorToDecimal(5)).toBe('0.05');
  });
});

describe('minorToInput', () => {
  it('drops .00 but keeps real paise', () => {
    expect(minorToInput(12000)).toBe('120');
    expect(minorToInput(1550)).toBe('15.50');
  });
});

describe('totals', () => {
  it('lineTotal rounds fractional quantities to the nearest paisa', () => {
    expect(lineTotal(12.4, 1500)).toBe(18600); // 12.4 km × ₹15
    expect(lineTotal(0.333, 1000)).toBe(333);
  });

  it('computes subtotal, discount and total', () => {
    const lines = [
      { qty: 2, unit_price_minor: 4500 },
      { qty: 12.4, unit_price_minor: 1500 },
    ];
    expect(computeTotals(lines, 600)).toEqual({ subtotal: 27600, discount: 600, total: 27000 });
  });

  it('clamps discount to the subtotal and to zero', () => {
    const lines = [{ qty: 1, unit_price_minor: 1000 }];
    expect(computeTotals(lines, 5000)).toEqual({ subtotal: 1000, discount: 1000, total: 0 });
    expect(computeTotals(lines, -50)).toEqual({ subtotal: 1000, discount: 0, total: 1000 });
  });

  it('handles an empty bill', () => {
    expect(computeTotals([], 0)).toEqual({ subtotal: 0, discount: 0, total: 0 });
  });
});

describe('dates and bill numbers', () => {
  it('todayISO uses local date parts', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('formatDate', () => {
    expect(formatDate('2026-10-11')).toBe('11 Oct 2026');
    expect(formatDate('garbage')).toBe('garbage');
  });
  it('isValidISODate', () => {
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('26-2-1')).toBe(false);
  });
  it('formatBillNo pads to 4 digits', () => {
    expect(formatBillNo('INV-', 7)).toBe('INV-0007');
    expect(formatBillNo('', 12345)).toBe('12345');
  });
});

describe('minNextBillNo', () => {
  it('is one past the highest number used with this prefix', () => {
    expect(minNextBillNo('INV-', ['INV-0007', 'INV-12', 'INV-0003'])).toBe(13);
  });
  it('ignores other prefixes and non-numeric suffixes', () => {
    expect(minNextBillNo('INV-', ['TX-0099', 'INV-0002', 'INV-ABC'])).toBe(3);
  });
  it('starts at 1 with no bills', () => {
    expect(minNextBillNo('INV-', [])).toBe(1);
  });
  it('handles an empty prefix', () => {
    expect(minNextBillNo('', ['0041', 'INV-0100'])).toBe(42);
  });
});

describe('isoToDate', () => {
  it('round-trips with todayISO in local time', () => {
    const d = isoToDate('2026-03-09');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 9, 0]);
    expect(todayISO(d)).toBe('2026-03-09');
  });
});
