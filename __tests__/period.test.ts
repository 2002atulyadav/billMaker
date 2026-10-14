import { formatPeriod, fyPeriod, inPeriod, monthPeriod, presetPeriod } from '@/lib/period';

const oct14 = new Date(2026, 9, 14);

describe('monthPeriod', () => {
  it('covers the whole month, including 31-day and leap months', () => {
    expect(monthPeriod(oct14)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(monthPeriod(new Date(2028, 1, 10))).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });
  it('shifts across year boundaries', () => {
    expect(monthPeriod(new Date(2026, 0, 5), -1)).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });
});

describe('fyPeriod', () => {
  it('runs April to March', () => {
    expect(fyPeriod(oct14)).toEqual({ start: '2026-04-01', end: '2027-03-31' });
    expect(fyPeriod(new Date(2026, 2, 31))).toEqual({ start: '2025-04-01', end: '2026-03-31' });
    expect(fyPeriod(new Date(2026, 3, 1))).toEqual({ start: '2026-04-01', end: '2027-03-31' });
  });
  it('last FY', () => {
    expect(fyPeriod(oct14, -1)).toEqual({ start: '2025-04-01', end: '2026-03-31' });
  });
});

describe('presetPeriod', () => {
  it('maps presets to ranges', () => {
    expect(presetPeriod('last-month', oct14)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(presetPeriod('this-year', oct14)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(presetPeriod('last-fy', oct14)).toEqual({ start: '2025-04-01', end: '2026-03-31' });
  });
});

describe('inPeriod', () => {
  it('is inclusive at both ends', () => {
    const p = { start: '2026-10-01', end: '2026-10-31' };
    expect(inPeriod('2026-10-01', p)).toBe(true);
    expect(inPeriod('2026-10-31', p)).toBe(true);
    expect(inPeriod('2026-11-01', p)).toBe(false);
    expect(inPeriod('2026-09-30', p)).toBe(false);
  });
});

describe('formatPeriod', () => {
  it.each([
    [{ start: '2026-10-01', end: '2026-10-31' }, 'October 2026'],
    [{ start: '2026-01-01', end: '2026-12-31' }, '2026'],
    [{ start: '2026-04-01', end: '2027-03-31' }, 'FY 2026-27'],
    [{ start: '2026-10-01', end: '2026-10-15' }, '1 Oct – 15 Oct 2026'],
    [{ start: '2026-12-20', end: '2027-01-10' }, '20 Dec 2026 – 10 Jan 2027'],
    [{ start: '2026-10-05', end: '2026-10-05' }, '5 Oct 2026'],
  ])('%p -> %s', (p, label) => {
    expect(formatPeriod(p)).toBe(label);
  });
});
