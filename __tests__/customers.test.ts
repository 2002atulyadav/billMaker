import { isSameCustomer, suggestCustomers } from '@/lib/customers';

const recent = [
  { customer_name: 'Asha', customer_phone: '98765 43210', last_bill_id: 9 },
  { customer_name: 'Ravi Kumar', customer_phone: '', last_bill_id: 7 },
  { customer_name: '', customer_phone: '91234 56789', last_bill_id: 5 },
  { customer_name: 'Rashmi', customer_phone: '90000 11111', last_bill_id: 3 },
];

describe('suggestCustomers', () => {
  it('shows recent customers when nothing is typed', () => {
    expect(suggestCustomers(recent, '', '').map((r) => r.last_bill_id)).toEqual([9, 7, 5, 3]);
    expect(suggestCustomers(recent, '', '', 2)).toHaveLength(2);
  });

  it('matches name case-insensitively anywhere in the name', () => {
    expect(suggestCustomers(recent, 'ra', '').map((r) => r.customer_name)).toEqual(['Ravi Kumar', 'Rashmi']);
    expect(suggestCustomers(recent, 'KUMAR', '').map((r) => r.customer_name)).toEqual(['Ravi Kumar']);
  });

  it('matches phone by digits, ignoring spaces', () => {
    expect(suggestCustomers(recent, '', '9123').map((r) => r.last_bill_id)).toEqual([5]);
    expect(suggestCustomers(recent, '', '5 4321').map((r) => r.last_bill_id)).toEqual([9]);
  });

  it('does not suggest the customer already entered', () => {
    expect(suggestCustomers(recent, 'asha', '9876543210').map((r) => r.last_bill_id)).not.toContain(9);
  });
});

describe('isSameCustomer', () => {
  it('ignores case, surrounding spaces and phone formatting', () => {
    expect(isSameCustomer(recent[0], ' ASHA ', '+9876543210')).toBe(true);
    expect(isSameCustomer(recent[0], 'Asha', '')).toBe(false);
  });
});
