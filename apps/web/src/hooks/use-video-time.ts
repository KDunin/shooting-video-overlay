import { useEffect, useRef, useState } from "react";

/**
 * Track a <video> element's currentTime smoothly via requestAnimationFrame (the native
 * `timeupdate` event only fires ~4x/sec, too coarse for the overlay). Also exposes
 * play state and duration.
 *
 * Accepts the element directly (not a ref) so the effect re-runs whenever the element
 * is swapped out — e.g. when the layout switches between resizable and simple panels.
 */
export function useVideoTime(video: HTMLVideoElement | null) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const el = video;
    if (!el) return;

    const loop = () => {
      setTime(el.currentTime);
      raf.current = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      setPlaying(true);
      raf.current = requestAnimationFrame(loop);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(raf.current);
      setTime(el.currentTime);
    };
    const onMeta = () => setDuration(el.duration || 0);
    const onSeek = () => setTime(el.currentTime);

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("seeked", onSeek);
    if (el.readyState >= 1) onMeta();

    return () => {
      cancelAnimationFrame(raf.current);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("seeked", onSeek);
    };
  }, [video]);

  return { time, playing, duration };
}
