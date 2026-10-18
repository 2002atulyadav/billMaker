import { addDays, balanceOf, daysBetween, dueState } from '@/lib/due';
import { clientReminderMessage, reminderMessage } from '@/lib/whatsapp';
import type { Bill, Client, Profile } from '@/types';

describe('due dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-18', 7)).toBe('2026-10-25');
    expect(addDays('2026-10-28', 7)).toBe('2026-11-04');
    expect(addDays('2026-12-30', 15)).toBe('2027-01-14');
    expect(addDays('2026-10-18', 0)).toBe('2026-10-18');
    expect(daysBetween('2026-10-10', '2026-10-18')).toBe(8);
    expect(daysBetween('2026-10-18', '2026-10-10')).toBe(-8);
  });

  it('says where a bill stands', () => {
    const today = '2026-10-18';
    expect(dueState({ due_date: null, status: 'unpaid' }, today)).toEqual({ kind: 'none' });
    expect(dueState({ due_date: '2026-10-10', status: 'paid' }, today)).toEqual({ kind: 'none' });
    expect(dueState({ due_date: '2026-10-15', status: 'partial' }, today)).toEqual({ kind: 'overdue', days: 3 });
    expect(dueState({ due_date: '2026-10-18', status: 'unpaid' }, today)).toEqual({ kind: 'today' });
    expect(dueState({ due_date: '2026-10-25', status: 'unpaid' }, today)).toEqual({ kind: 'due', date: '2026-10-25' });
  });

  it('never reports a negative balance', () => {
    expect(balanceOf({ total_minor: 1000, paid_minor: 400 })).toBe(600);
    expect(balanceOf({ total_minor: 1000, paid_minor: 1200 })).toBe(0);
  });
});

const profile: Profile = {
  business_name: 'Sharma Transport', owner_name: '', phone: '', address: '', logo_uri: null, currency: '₹',
  bill_prefix: 'TR-', upi_id: 'ravi@okhdfc', trade: 'transport', language: 'en', bill_language: 'en',
  next_bill_no: 3, last_backup_at: null, app_lock: 0,
};
const bill = (extra: Partial<Bill>): Bill => ({
  id: 1, bill_no: 'TR-0001', customer_name: 'Ramesh', customer_phone: '9876543210', date: '2026-10-01',
  discount_minor: 0, notes: '', subtotal_minor: 504500, total_minor: 504500, status: 'partial', paid_minor: 200000,
  paid_at: null, due_date: '2026-10-08', last_reminded_at: null, client_id: null, customer_address: '',
  period_start: null, period_end: null, detail_fields: [], created_at: '', ...extra,
});

describe('reminder messages', () => {
  it('asks for the balance, with due date and UPI', () => {
    expect(reminderMessage(bill({}), profile)).toBe(
      [
        'Hi Ramesh,',
        'A gentle reminder about bill TR-0001 from Sharma Transport dated 1 Oct 2026.',
        'Amount pending: ₹3,045.00',
        'Due date: 8 Oct 2026',
        'Pay by UPI: ravi@okhdfc',
        'Please ignore this if you’ve already paid. Thank you!',
      ].join('\n'),
    );
  });

  it('is in Hindi when bills are in Hindi, and skips what is missing', () => {
    const msg = reminderMessage(bill({ due_date: null, customer_name: '', status: 'unpaid', paid_minor: 0 }), {
      ...profile, bill_language: 'hi', upi_id: '',
    });
    expect(msg).toContain('बाकी रकम: ₹5,045.00');
    expect(msg).not.toContain('आख़िरी तारीख़');
    expect(msg).not.toContain('UPI');
  });

  it('sums a client’s unpaid bills', () => {
    const client: Client = { id: 1, name: 'Acme', phone: '1', address: '' };
    const msg = clientReminderMessage(
      client,
      [bill({}), bill({ id: 2, bill_no: 'TR-0002', status: 'unpaid', paid_minor: 0, total_minor: 100000 }), bill({ id: 3, status: 'paid', paid_minor: 504500 })],
      profile,
    );
    expect(msg).toContain('₹4,045.00 is pending across 2 bills');
    expect(msg).toContain('• TR-0001 (1 Oct 2026): ₹3,045.00');
    expect(msg).toContain('• TR-0002 (1 Oct 2026): ₹1,000.00');
  });
});
