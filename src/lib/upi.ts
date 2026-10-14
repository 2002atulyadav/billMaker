import createQr from 'qrcode-generator';

import { minorToDecimal } from '@/lib/money';

const VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

/** "ravi@okhdfc" style UPI ID (VPA). */
export function isValidUpiId(id: string): boolean {
  return VPA_RE.test(id.trim());
}

/**
 * UPI deep link (NPCI "upi://pay" spec). Any UPI app (GPay, PhonePe, Paytm, BHIM) opens it
 * with payee, amount and note pre-filled. Amounts are always INR.
 */
export function upiLink(opts: { upiId: string; payeeName: string; amountMinor: number; note: string }): string {
  const params = [
    `pa=${opts.upiId.trim()}`,
    `pn=${encodeURIComponent(opts.payeeName)}`,
    opts.amountMinor > 0 ? `am=${minorToDecimal(opts.amountMinor)}` : null,
    'cu=INR',
    `tn=${encodeURIComponent(opts.note)}`,
  ];
  return `upi://pay?${params.filter(Boolean).join('&')}`;
}

export type QrMatrix = {
  /** modules per side, excluding the quiet zone */
  size: number;
  /** SVG path data, one 1×1 square per dark module, in module units */
  path: string;
};

/** Encodes text as a QR code. Rendered as an SVG path so it works in both the PDF HTML and react-native-svg. */
export function qrMatrix(text: string): QrMatrix {
  const qr = createQr(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.isDark(y, x)) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, path };
}

/** Standalone <svg> with a 4-module quiet zone, for embedding in HTML. */
export function qrSvg(text: string, pixelSize: number): string {
  const { size, path } = qrMatrix(text);
  const vb = size + 8;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}" ` +
    `viewBox="-4 -4 ${vb} ${vb}" shape-rendering="crispEdges">` +
    `<rect x="-4" y="-4" width="${vb}" height="${vb}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
  );
}
