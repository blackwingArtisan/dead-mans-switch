import type { SwitchState } from '../../core/types';

interface Props {
  /** 0..1 of the current cadence that remains. */
  remaining: number;
  state: SwitchState;
  size?: number;
}

/**
 * The vigil candle. Its wax burns down over the check-in cadence, its flame gutters in
 * grace, and it smokes once witnesses are asked. Purely decorative: the same facts are
 * always given in text beside it.
 */
export function Candle({ remaining, state, size = 320 }: Props) {
  const lit = state === 'alive' || state === 'reminder' || state === 'grace' || state === 'paused';
  const wax =
    state === 'grace' ? 0.05 : state === 'confirm' || state === 'released' ? 0.03 : Math.max(0.06, Math.min(1, remaining));
  const base = 300;
  const height = 26 + 214 * wax;
  const top = base - height;
  const flameScale = state === 'grace' ? 0.55 : state === 'reminder' ? 0.85 : 1;

  return (
    <svg
      className={`candle candle--${state}`}
      viewBox="0 0 200 360"
      width={size * (200 / 360)}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="c-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffcf7a" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#ff8a3d" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="c-wax" x1="0" x2="1">
          <stop offset="0%" stopColor="#8d7f69" />
          <stop offset="22%" stopColor="#efe3c8" />
          <stop offset="55%" stopColor="#e2d3b2" />
          <stop offset="100%" stopColor="#6e6150" />
        </linearGradient>
        <linearGradient id="c-wax-lit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd9a0" stopOpacity="0.7" />
          <stop offset="30%" stopColor="#ffd9a0" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="c-flame" cx="50%" cy="72%" r="60%">
          <stop offset="0%" stopColor="#fffbe8" />
          <stop offset="28%" stopColor="#ffe39a" />
          <stop offset="62%" stopColor="#ff9d3d" />
          <stop offset="100%" stopColor="#d9481f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="c-core" cx="50%" cy="80%" r="50%">
          <stop offset="0%" stopColor="#6fa0ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6fa0ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="c-iron" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6b5a45" />
          <stop offset="100%" stopColor="#241a12" />
        </linearGradient>
      </defs>

      {lit && <circle className="candle__glow" cx="100" cy={top - 26} r={state === 'grace' ? 70 : 120} fill="url(#c-glow)" />}

      {/* chamberstick */}
      <ellipse cx="100" cy="318" rx="86" ry="17" fill="url(#c-iron)" />
      <ellipse cx="100" cy="312" rx="80" ry="13" fill="#3a2c20" />
      <ellipse cx="100" cy="309" rx="70" ry="9" fill="#1b140e" opacity="0.8" />
      <path d="M176 314 q22 0 20 -18 q-2 -14 -18 -10" fill="none" stroke="#4d3d2d" strokeWidth="7" strokeLinecap="round" />
      <rect x="62" y="296" width="76" height="12" rx="4" fill="#4d3d2d" />

      {/* wax body */}
      <g className="candle__wax">
        <rect x="70" y={top} width="60" height={height} fill="url(#c-wax)" rx="3" />
        {lit && <rect x="70" y={top} width="60" height={Math.min(60, height)} fill="url(#c-wax-lit)" />}
        <ellipse cx="100" cy={top} rx="30" ry="6" fill="#f6ecd6" />
        <ellipse cx="100" cy={top + 1} rx="22" ry="3.6" fill={lit ? '#ffe2a6' : '#d8c9a8'} opacity="0.85" />
        {/* drips */}
        <path d={`M76 ${top + 2} q-3 18 1 ${24 + wax * 30} q4 6 6 -2 q1 -12 -1 -22`} fill="#ece0c4" />
        <path d={`M118 ${top + 3} q2 10 -1 ${14 + wax * 50} q3 7 7 1 q2 -9 0 -15`} fill="#e7dabd" />
        <path d={`M128 ${top + 4} q3 26 -2 ${40 + wax * 40} q2 6 5 0 q1 -20 -1 -42`} fill="#d9cba9" opacity="0.9" />
      </g>

      {/* wick */}
      <path d={`M100 ${top - 1} q-1 -6 1 -13`} stroke={lit ? '#2a1a10' : '#4a3a2c'} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {lit && <circle cx="101" cy={top - 14} r="1.6" fill="#ff7a2e" />}

      {lit && (
        <g className="candle__flame" style={{ transformOrigin: `100px ${top - 10}px`, transform: `scale(${flameScale})` }}>
          <g className="candle__flame-inner" style={{ transformOrigin: `100px ${top - 10}px` }}>
            <path
              d={`M100 ${top - 70} C 112 ${top - 44}, 118 ${top - 26}, 112 ${top - 14} C 107 ${top - 4}, 93 ${top - 4}, 88 ${top - 14} C 82 ${top - 26}, 90 ${top - 46}, 100 ${top - 70} Z`}
              fill="url(#c-flame)"
            />
            <ellipse cx="100" cy={top - 16} rx="6" ry="9" fill="url(#c-core)" />
          </g>
        </g>
      )}

      {state === 'confirm' && (
        <g className="candle__smoke" fill="none" stroke="#b8ab98" strokeLinecap="round">
          <path d={`M100 ${top - 14} c -10 -14, 12 -24, 0 -40 c -12 -16, 10 -26, -2 -44`} strokeWidth="2.2" />
          <path d={`M102 ${top - 20} c 12 -12, -8 -26, 6 -40 c 12 -12, -6 -24, 4 -40`} strokeWidth="1.4" />
        </g>
      )}

      {state === 'paused' && (
        <path
          className="candle__cloche"
          d={`M56 304 L56 ${top - 70} Q56 ${top - 120} 100 ${top - 124} Q144 ${top - 120} 144 ${top - 70} L144 304`}
          fill="rgba(180,200,220,0.08)"
          stroke="rgba(220,230,240,0.45)"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
