import { useState } from "react";

interface Props {
  /** Path under client/public, e.g. "/story/shots/drive-cover.webp". */
  src: string;
  /** Emoji shown if the image is missing or fails to load. */
  fallbackEmoji: string;
  /** Alt text for accessibility. */
  alt: string;
}

/** Renders a story image with emoji fallback. The fallback fires both
 *  on initial 404 (file not yet sourced) and on any load error. This
 *  means dropping a webp into client/public/story/ instantly upgrades
 *  the placeholder; no code change required. */
export function StoryImage({ src, fallbackEmoji, alt }: Props) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <span className="story-emoji" role="img" aria-label={alt}>
        {fallbackEmoji}
      </span>
    );
  }

  return (
    <img
      className="story-image"
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      loading="eager"
      decoding="async"
    />
  );
}
