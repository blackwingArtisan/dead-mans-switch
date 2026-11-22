import { useEffect, useRef } from 'react';
import { playStory, resetDemo, stopStory, useStory } from '../lib/story';

/** Captions for "Play the whole story", read out politely as they change. */
export function StoryCaptions() {
  const story = useStory();
  const ref = useRef<HTMLDivElement>(null);
  const shown = Boolean(story.caption) || story.playing;

  // While the caption is up the page reserves its height (--story-h, read by app.css), so a control is never stuck under it.
  useEffect(() => {
    const el = ref.current;
    if (!shown || !el) return;
    document.body.dataset.story = '';
    const size = () => document.documentElement.style.setProperty('--story-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    size();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(size);
    watch?.observe(el);
    return () => {
      watch?.disconnect();
      delete document.body.dataset.story;
      document.documentElement.style.removeProperty('--story-h');
    };
  }, [shown]);

  // When the demo stops answering, put the keyboard on the first way out.
  const resetRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (story.failed) resetRef.current?.focus();
  }, [story.failed, story.caption]);

  if (!shown) return null;
  return (
    <div className="story" data-testid="story" ref={ref}>
      <div className="story__body">
        <p className="story__caption" role="status" aria-live="polite">
          {story.playing && (
            <span className="story__step">
              {story.step} of {story.steps}
            </span>
          )}
          {story.caption}
        </p>
        {story.failed && (
          <div className="story__actions">
            <button type="button" className="btn btn--wax btn--small" ref={resetRef} onClick={() => void resetDemo()}>
              Reset the demo
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => void playStory(true)}>
              Play it again
            </button>
          </div>
        )}
      </div>
      <button type="button" className="icon-btn story__stop" onClick={stopStory} aria-label={story.playing ? 'Stop the story' : 'Close'}>
        ×
      </button>
    </div>
  );
}
