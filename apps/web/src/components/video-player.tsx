import { forwardRef } from "react";
import type { ReactNode } from "react";

interface VideoPlayerProps {
  src: string;
  overlay?: ReactNode;
  /**
   * "fill" – video fills parent element; parent must define height (e.g. inside a ResizablePanel).
   * "fluid" – video is width-based and maintains its aspect ratio (default, works anywhere).
   */
  variant?: "fill" | "fluid";
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, overlay, variant = "fluid" }, ref) => {
    return (
      <div
        className={
          variant === "fill"
            ? "relative h-full overflow-hidden rounded-lg bg-black"
            : "relative aspect-video w-full overflow-hidden rounded-lg bg-black"
        }
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={ref} src={src} controls className="h-full w-full object-contain" />
        {overlay}
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
