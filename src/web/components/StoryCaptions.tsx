import { stopStory, useStory } from '../lib/story';

/** Captions for "Play the whole story", read out politely as they change. */
export function StoryCaptions() {
  const story = useStory();
  if (!story.caption && !story.playing) return null;
  return (
    <div className="story" data-testid="story">
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
