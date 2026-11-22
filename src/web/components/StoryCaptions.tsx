import { useEffect, useRef } from 'react';
import { stopStory, useStory } from '../lib/story';

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

  if (!shown) return null;
  return (
    <div className="story" data-testid="story" ref={ref}>
      <p className="story__caption" role="status" aria-live="polite">
        {story.playing && (
          <span className="story__step">
            {story.step} of {story.steps}
          </span>
        )}
        {story.caption}
      </p>
      <button type="button" className="icon-btn story__stop" onClick={stopStory} aria-label={story.playing ? 'Stop the story' : 'Close'}>
        ×
      </button>
    </div>
  );
}
