import { formatDate, isoToDate, todayISO } from '@/lib/money';

/** Inclusive date range, both ends "YYYY-MM-DD". */
export type Period = { start: string; end: string };

export type PeriodPreset = 'this-month' | 'last-month' | 'this-year' | 'this-fy' | 'last-fy';

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-year', label: 'This year' },
  { value: 'this-fy', label: 'This FY' },
  { value: 'last-fy', label: 'Last FY' },
];

const iso = (y: number, m: number, d: number) => todayISO(new Date(y, m, d));

/** Calendar month containing `today`, shifted by `offset` months. */
export function monthPeriod(today: Date, offset = 0): Period {
  const y = today.getFullYear();
  const m = today.getMonth() + offset;
  return { start: iso(y, m, 1), end: iso(y, m + 1, 0) };
}

/** Indian financial year (1 Apr – 31 Mar) containing `today`, shifted by `offset` years. */
export function fyPeriod(today: Date, offset = 0): Period {
  const startYear = (today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1) + offset;
  return { start: iso(startYear, 3, 1), end: iso(startYear + 1, 2, 31) };
}

export function presetPeriod(preset: PeriodPreset, today = new Date()): Period {
  switch (preset) {
    case 'this-month':
      return monthPeriod(today);
    case 'last-month':
      return monthPeriod(today, -1);
    case 'this-year':
      return { start: iso(today.getFullYear(), 0, 1), end: iso(today.getFullYear(), 11, 31) };
    case 'this-fy':
      return fyPeriod(today);
    case 'last-fy':
      return fyPeriod(today, -1);
  }
}

export function inPeriod(date: string, p: Period): boolean {
  return date >= p.start && date <= p.end;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Human label for a period: "October 2026", "2026", "FY 2026-27", or "1 Oct – 15 Oct 2026".
 */
export function formatPeriod(p: Period): string {
  const s = isoToDate(p.start);
  const e = isoToDate(p.end);
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth && s.getDate() === 1 && p.end === monthPeriod(s).end) {
    return `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  }
  if (p.start === iso(s.getFullYear(), 0, 1) && p.end === iso(s.getFullYear(), 11, 31)) {
    return String(s.getFullYear());
  }
  if (p.start === iso(s.getFullYear(), 3, 1) && p.end === iso(s.getFullYear() + 1, 2, 31)) {
    return `FY ${s.getFullYear()}-${String((s.getFullYear() + 1) % 100).padStart(2, '0')}`;
  }
  if (p.start === p.end) return formatDate(p.start);
  const startLabel = formatDate(p.start);
  // Drop the repeated year: "1 Oct – 15 Oct 2026".
  const trimmed = s.getFullYear() === e.getFullYear() ? startLabel.replace(/ \d{4}$/, '') : startLabel;
  return `${trimmed} – ${formatDate(p.end)}`;
}
