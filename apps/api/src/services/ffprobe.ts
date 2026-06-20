/**
 * Probe container metadata with ffprobe. Runs the binary that ships in the API image
 * (apps/api/Dockerfile installs ffmpeg). Returns nulls rather than throwing on partial data.
 */
export interface VideoMeta {
  durationS: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  sampleRate: number | null;
}

const parseFps = (rate?: string): number | null => {
  if (!rate) return null;
  const [num, den] = rate.split("/").map(Number);
  if (!num || !den) return null;
  return num / den;
};

export async function probeVideo(path: string): Promise<VideoMeta> {
  const proc = Bun.spawn(
    ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
    { stdout: "pipe", stderr: "pipe" },
  );
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) return { durationS: null, fps: null, width: null, height: null, sampleRate: null };

  const data = JSON.parse(out) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      sample_rate?: string;
    }>;
  };

  const video = data.streams?.find((s) => s.codec_type === "video");
  const audio = data.streams?.find((s) => s.codec_type === "audio");

  return {
    durationS: data.format?.duration ? Number(data.format.duration) : null,
    fps: parseFps(video?.r_frame_rate),
    width: video?.width ?? null,
    height: video?.height ?? null,
    sampleRate: audio?.sample_rate ? Number(audio.sample_rate) : null,
  };
}
