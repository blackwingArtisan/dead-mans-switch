import { useEffect } from 'react';
import { sound, useSoundOn } from '../lib/sound';

/**
 * "Hear the room": the one switch for the generated room sound. Off by default; the
 * press that turns it on is the gesture browsers need before audio can start.
 */
export function SoundToggle() {
  const on = useSoundOn();

  // Sound left on last time starts again on the first press anywhere, never on its own.
  useEffect(() => {
    if (!on) return;
    const wake = () => sound.wake();
    window.addEventListener('pointerdown', wake, { once: true });
    window.addEventListener('keydown', wake, { once: true });
    return () => {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [on]);

  return (
    <button
      type="button"
      className={`sound-toggle ${on ? 'sound-toggle--on' : ''}`}
      aria-pressed={on}
      onClick={() => sound.set(!on)}
      data-testid="sound-toggle"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {on ? (
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </svg>
      <span>{on ? 'Sound on' : 'Hear the room'}</span>
    </button>
  );
}
