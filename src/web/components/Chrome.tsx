import type { ReactNode } from 'react';
import { Link } from '../lib/router';

/**
 * The room: warm glow, drifting embers, night, smoke, moonlight and a vignette. Which layers
 * show is driven by `data-room` on <body> (see lib/room.ts), so the whole page dims as the
 * candle does. Decorative only, hidden from assistive tech.
 */
export function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="atmosphere__warm">
        <div className="atmosphere__glow" />
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="ember" style={{ ['--i' as string]: i }} />
        ))}
      </div>
      <div className="atmosphere__sick" />
      <div className="atmosphere__deep" />
      <div className="atmosphere__night" />
      <div className="atmosphere__moon" />
      <div className="atmosphere__smoke" />
      <div className="atmosphere__cold" />
      <div className="atmosphere__grain" />
      <div className="atmosphere__flare" />
    </div>
  );
}

export function Flourish({ className = '' }: { className?: string }) {
  return (
    <svg className={`flourish ${className}`} viewBox="0 0 240 20" aria-hidden="true" focusable="false">
      <path d="M4 10 H96 M144 10 H236" stroke="currentColor" strokeWidth="1" />
      <path d="M96 10 q8 -8 16 0 q8 8 16 0 q8 -8 16 0" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="120" cy="10" r="2.6" fill="currentColor" />
      <circle cx="4" cy="10" r="1.6" fill="currentColor" />
      <circle cx="236" cy="10" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="masthead">
        <Link href="/" className="masthead__brand">
          <span className="masthead__mark" aria-hidden="true">
            ✝
          </span>
          Last Candle
        </Link>
        <span className="masthead__tag">letters that wait</span>
      </header>
      <main id="main" className={`page ${wide ? 'page--wide' : ''}`} tabIndex={-1}>
        {children}
      </main>
      <footer className="colophon">
        <Flourish />
        <p>
          Letters are sealed in your browser with AES-GCM. The vault keeps half a key; the other half stays with the
          people you love. <Link href="/how-it-works">How the seal works</Link>
        </p>
        <p className="colophon__small">Stubborn Otter Software · Kiroween 2026</p>
      </footer>
    </>
  );
}
