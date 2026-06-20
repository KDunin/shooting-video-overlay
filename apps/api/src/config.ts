/**
 * Centralised runtime configuration for the API. All paths/URLs come from the
 * environment so the same image runs in Docker (shared /media volume) and locally.
 */
const env = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env var: ${key}`);
  return value;
};

export const config = {
  port: Number(env("API_PORT", "3001")),
  databaseUrl: env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/guns"),
  /** Root of the shared media volume; subfolders created on demand. */
  mediaDir: env("MEDIA_DIR", "./.media"),
  /** Hard cap on upload size (bytes). Default 2 GiB. */
  maxUploadBytes: Number(env("MAX_UPLOAD_BYTES", String(2 * 1024 * 1024 * 1024))),
  /** Allowed upload content types. */
  allowedMimeTypes: ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"],
} as const;

export const mediaPaths = {
  video: (id: string) => `${config.mediaDir}/videos/${id}`,
  audio: (id: string) => `${config.mediaDir}/audio/${id}.wav`,
  peaks: (id: string) => `${config.mediaDir}/peaks/${id}.json`,
};
