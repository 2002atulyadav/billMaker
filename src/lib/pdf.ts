import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { billToHtml } from '@/lib/billHtml';
import { statementToHtml } from '@/lib/statementHtml';
import type { BillWithLines, Profile } from '@/types';

/** Renders the bill to a PDF named after the bill number and opens the share sheet. */
export async function shareBillPdf(bill: BillWithLines, profile: Profile): Promise<void> {
  await shareHtmlAsPdf(billToHtml(bill, profile), `Bill-${bill.bill_no}`, `Share ${bill.bill_no}`);
}

/** Renders a client's statement of account for the period and opens the share sheet. */
export async function shareStatementPdf(opts: Parameters<typeof statementToHtml>[0]): Promise<void> {
  const name = `Statement-${opts.client.name}-${opts.period.start}-to-${opts.period.end}`;
  await shareHtmlAsPdf(statementToHtml(opts), name, `Share statement for ${opts.client.name}`);
}

async function shareHtmlAsPdf(html: string, fileBase: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });

  // printToFileAsync produces a random file name; rename so the customer sees e.g. "Bill-INV-0001.pdf".
  const safeName = fileBase.replace(/[^\w-]+/g, '_').slice(0, 80);
  const target = new File(Paths.cache, `${safeName}.pdf`);
  if (target.exists) target.delete();
  await new File(uri).move(target);

  await assertCanShare();
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
}

/** Captures the on-screen bill (BillPaper) as a PNG and opens the share sheet. Images preview inline in WhatsApp. */
export async function shareBillImage(view: RefObject<View | null>, billNo: string): Promise<void> {
  const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  await assertCanShare();
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: `Share ${billNo}` });
}

export async function assertCanShare(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
}
