import { isoToDate, todayISO } from '@/lib/money';
import type { Bill } from '@/types';

/** Due-date choices offered when making a bill: on receipt (0) or in N days. */
export const DUE_PRESETS = [0, 7, 15, 30] as const;

/** "2026-10-18" + 7 -> "2026-10-25" (local dates, so month ends and DST are safe). */
export function addDays(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((isoToDate(to).getTime() - isoToDate(from).getTime()) / 86_400_000);
}

export type DueState =
  | { kind: 'none' }
  | { kind: 'due'; date: string }
  | { kind: 'today' }
  | { kind: 'overdue'; days: number };

/** Where a bill stands against its due date. Fully paid bills are never due. */
export function dueState(bill: Pick<Bill, 'due_date' | 'status'>, today = todayISO()): DueState {
  if (!bill.due_date || bill.status === 'paid') return { kind: 'none' };
  const d = daysBetween(bill.due_date, today);
  if (d > 0) return { kind: 'overdue', days: d };
  if (d === 0) return { kind: 'today' };
  return { kind: 'due', date: bill.due_date };
}

export const balanceOf = (bill: Pick<Bill, 'total_minor' | 'paid_minor'>) => Math.max(0, bill.total_minor - bill.paid_minor);
