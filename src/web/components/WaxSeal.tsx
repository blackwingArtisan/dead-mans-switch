import { useId, useMemo } from 'react';

interface Props {
  size?: number;
  /** A letter or short monogram stamped into the wax. Omit for the candle sigil. */
  mark?: string;
  /** Wax colour family. */
  tone?: 'oxblood' | 'ember' | 'verdigris' | 'ink' | 'gold';
  cracked?: boolean;
  className?: string;
}

const TONES: Record<NonNullable<Props['tone']>, [string, string, string]> = {
  oxblood: ['#c23b30', '#8e1b1b', '#4a0b0c'],
  ember: ['#e2733a', '#a84418', '#55200a'],
  verdigris: ['#6fa595', '#3f6e61', '#1d3a33'],
  ink: ['#5a5f8f', '#2f335c', '#14162e'],
  gold: ['#e6c26e', '#a8802f', '#584015'],
};

/** Deterministic pseudo-random wobble so each seal's edge is irregular but stable. */
function edgePath(seed: string, r = 46, points = 28): string {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r + (rand() - 0.5) * 6 + (i % 3 === 0 ? 2.5 : 0);
    pts.push([50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr]);
  }
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    const m = mid(p, q);
    d += i === 0 ? `M${m[0]!.toFixed(2)} ${m[1]!.toFixed(2)}` : '';
    const n = mid(q, pts[(i + 2) % pts.length]!);
    d += ` Q${q[0].toFixed(2)} ${q[1].toFixed(2)} ${n[0]!.toFixed(2)} ${n[1]!.toFixed(2)}`;
  }
  return d + ' Z';
}

export function WaxSeal({ size = 96, mark, tone = 'oxblood', cracked = false, className = '' }: Props) {
  const id = useId().replace(/:/g, '');
  const [hi, mid, lo] = TONES[tone];
  const edge = useMemo(() => edgePath(`${mark ?? 'sigil'}-${tone}`), [mark, tone]);
  return (
    <svg
      className={`wax-seal ${cracked ? 'wax-seal--cracked' : ''} ${className}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-g`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={hi} />
          <stop offset="55%" stopColor={mid} />
          <stop offset="100%" stopColor={lo} />
        </radialGradient>
        <radialGradient id={`${id}-in`} cx="60%" cy="66%" r="70%">
          <stop offset="0%" stopColor={hi} stopOpacity="0.55" />
          <stop offset="100%" stopColor={lo} stopOpacity="0.9" />
        </radialGradient>
        <filter id={`${id}-emboss`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="b" />
          <feSpecularLighting in="b" surfaceScale="2.4" specularConstant="0.7" specularExponent="18" lightingColor="#fff2dc" result="s">
            <fePointLight x="20" y="10" z="40" />
          </feSpecularLighting>
          <feComposite in="s" in2="SourceAlpha" operator="in" result="sl" />
          <feComposite in="SourceGraphic" in2="sl" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0" />
        </filter>
      </defs>
      <g className="wax-seal__body" filter={`url(#${id}-emboss)`}>
        <path d={edge} fill={`url(#${id}-g)`} />
        <circle cx="50" cy="50" r="33" fill={`url(#${id}-in)`} />
        <circle cx="50" cy="50" r="33" fill="none" stroke={lo} strokeWidth="1.6" opacity="0.8" />
        <circle cx="50" cy="50" r="29" fill="none" stroke={hi} strokeWidth="0.7" opacity="0.5" strokeDasharray="1.5 2.2" />
        {mark ? (
          <g style={{ fontVariantLigatures: 'none' }} fontFamily="'Cinzel Decorative', 'Cormorant Garamond', serif" fontWeight="700" fontSize={mark.length > 1 ? 24 : 36} textAnchor="middle" dominantBaseline="central">
            {/* One glyph only. The lit edge is a pale outline painted beneath the fill of the same
                text element, so thin marks such as "I" never show a second, offset copy. */}
            <text x="50" y="51.5" fill={lo} stroke={hi} strokeWidth="1.1" strokeLinejoin="round" paintOrder="stroke" strokeOpacity="0.7">
              {mark}
            </text>
          </g>
        ) : (
          <g fill={lo} stroke={hi} strokeWidth="0.5">
            {/* candle sigil */}
            <path d="M50 26 C54 32 55 36 52 40 C50 42 48 42 47 40 C45 36 46 32 50 26 Z" />
            <rect x="45" y="44" width="10" height="24" rx="1.2" />
            <path d="M38 70 H62 L59 74 H41 Z" />
          </g>
        )}
      </g>
      {cracked && (
        <path className="wax-seal__crack" d="M50 6 L46 28 L54 40 L44 55 L53 68 L48 94" fill="none" stroke="#120806" strokeWidth="2.2" strokeLinejoin="round" />
      )}
    </svg>
  );
}
