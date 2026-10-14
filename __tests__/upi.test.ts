import { isValidUpiId, qrMatrix, qrSvg, upiLink } from '@/lib/upi';

describe('isValidUpiId', () => {
  it.each(['ravi@okhdfc', 'ravi.kumar-1@ybl', '9876543210@paytm', ' asha@upi '])('accepts %p', (id) => {
    expect(isValidUpiId(id)).toBe(true);
  });
  it.each(['', 'ravi', '@okhdfc', 'ravi@', 'ravi kumar@ybl', 'ravi@1bank'])('rejects %p', (id) => {
    expect(isValidUpiId(id)).toBe(false);
  });
});

describe('upiLink', () => {
  it('builds an NPCI pay link with amount in rupees', () => {
    expect(upiLink({ upiId: 'ravi@okhdfc', payeeName: 'Ravi Taxi & Tours', amountMinor: 27050, note: 'TX-0001' })).toBe(
      'upi://pay?pa=ravi@okhdfc&pn=Ravi%20Taxi%20%26%20Tours&am=270.50&cu=INR&tn=TX-0001',
    );
  });
  it('omits the amount when zero so the payer can type it', () => {
    expect(upiLink({ upiId: 'a@b', payeeName: 'A', amountMinor: 0, note: 'x' })).not.toContain('am=');
  });
});

describe('qr', () => {
  const link = 'upi://pay?pa=ravi@okhdfc&pn=Ravi&am=270.00&cu=INR&tn=TX-0001';

  it('produces a square matrix with finder patterns', () => {
    const { size, path } = qrMatrix(link);
    expect(size).toBeGreaterThanOrEqual(21);
    expect((size - 17) % 4).toBe(0); // QR versions are 21, 25, 29, …
    expect(path.startsWith('M0 0h1v1h-1z')).toBe(true); // top-left finder corner is dark
  });

  it('renders a standalone svg', () => {
    const svg = qrSvg(link, 120);
    expect(svg).toMatch(/^<svg[^>]+width="120"/);
    expect(svg).toContain('<path d="M0 0');
  });
});
