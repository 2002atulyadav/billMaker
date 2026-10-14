import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { billToHtml } from '@/lib/billHtml';
import type { BillWithLines, Profile } from '@/types';

/** Renders the bill to a PDF named after the bill number and opens the share sheet. */
export async function shareBillPdf(bill: BillWithLines, profile: Profile): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: billToHtml(bill, profile) });

  // printToFileAsync produces a random file name; rename so the customer sees "Bill-INV-0001.pdf".
  const safeName = bill.bill_no.replace(/[^\w-]+/g, '_');
  const target = new File(Paths.cache, `Bill-${safeName}.pdf`);
  if (target.exists) target.delete();
  await new File(uri).move(target);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(target.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Share ${bill.bill_no}`,
  });
}
