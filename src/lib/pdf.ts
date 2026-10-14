import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

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

  await assertCanShare();
  await Sharing.shareAsync(target.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Share ${bill.bill_no}`,
  });
}

/** Captures the on-screen bill (BillPaper) as a PNG and opens the share sheet. Images preview inline in WhatsApp. */
export async function shareBillImage(view: RefObject<View | null>, billNo: string): Promise<void> {
  const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  await assertCanShare();
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: `Share ${billNo}` });
}

async function assertCanShare(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
}
