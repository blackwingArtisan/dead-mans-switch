import { WaxSeal } from './WaxSeal';

/**
 * The moment a letter is sealed: the page slides into its envelope, the flap folds down and the
 * seal is pressed. Decorative and hidden from assistive technology; under reduced motion it shows
 * the sealed envelope at rest.
 */
export function SealCeremony({ mark }: { mark?: string }) {
  return (
    <div className="ceremony-seal" aria-hidden="true" data-testid="seal-ceremony">
      <div className="ceremony-seal__envelope">
        <div className="ceremony-seal__back" />
        <div className="ceremony-seal__letter parchment">
          <span />
          <span />
          <span />
        </div>
        <div className="ceremony-seal__pocket" />
        <div className="ceremony-seal__flap" />
        <div className="ceremony-seal__stamp">
          <WaxSeal size={74} mark={mark} />
        </div>
      </div>
    </div>
  );
}

/** Envelopes lifting away into the dark, for the moment letters are delivered. */
export function DriftingEnvelopes({ count = 3 }: { count?: number }) {
  return (
    <div className="drift" aria-hidden="true" data-testid="drifting-envelopes">
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} className="drift__envelope" style={{ ['--i' as string]: i }} viewBox="0 0 60 40" width="60" height="40">
          <rect x="1" y="1" width="58" height="38" rx="2" />
          <path d="M1 2 L30 22 L59 2" />
          <circle cx="30" cy="22" r="5" />
        </svg>
      ))}
    </div>
  );
}
