import qrcode from 'qrcode-generator';
import { describe, expect, it } from 'vitest';

describe('keepsake QR code', () => {
  it('fits a full keepsake link at error-correction level M', () => {
    const link = `https://example.com/keepsake/L${'x'.repeat(22)}#k=${'A'.repeat(43)}`;
    const qr = qrcode(0, 'M');
    qr.addData(link, 'Byte');
    qr.make();
    // Version 6 or below (41 modules) keeps each module large enough to scan from a printed card.
    expect(qr.getModuleCount()).toBeLessThanOrEqual(41);
  });
});
