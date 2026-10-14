export type CustomerRef = { customer_name: string; customer_phone: string; last_bill_id: number };

const digits = (s: string) => s.replace(/\D/g, '');

/**
 * Suggestions for the customer fields on a new bill.
 * Empty fields -> most recent customers. Otherwise customers whose name contains the typed name
 * or whose phone contains the typed digits. Someone already exactly entered isn't suggested again.
 */
export function suggestCustomers<T extends CustomerRef>(recent: T[], name: string, phone: string, max = 6): T[] {
  const n = name.trim().toLowerCase();
  const p = digits(phone);
  return recent
    .filter((r) => {
      if (isSameCustomer(r, name, phone)) return false;
      if (!n && !p) return true;
      return (!!n && r.customer_name.toLowerCase().includes(n)) || (!!p && digits(r.customer_phone).includes(p));
    })
    .slice(0, max);
}

export function isSameCustomer(r: CustomerRef, name: string, phone: string): boolean {
  return r.customer_name.trim().toLowerCase() === name.trim().toLowerCase() && digits(r.customer_phone) === digits(phone);
}
