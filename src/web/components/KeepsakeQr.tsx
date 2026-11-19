import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/**
 * The keepsake link as a QR code, drawn as SVG rectangles (no innerHTML, so it stays inside the
 * CSP). Error correction level M; one path keeps the DOM small.
 */
export function KeepsakeQr({ value, size = 168, label }: { value: string; size?: number; label: string }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    }
    return { path: d, count: n + 8 };
  }, [value]);

  return (
    <svg className="keepsake-qr" width={size} height={size} viewBox={`0 0 ${count} ${count}`} role="img" aria-label={label} data-testid="keepsake-qr" shapeRendering="crispEdges">
      <rect width={count} height={count} fill="#fffaf0" />
      <path d={path} fill="#1d130b" />
    </svg>
  );
}
