import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { config, mediaPaths } from "../config";

/** Create the media subfolders once at boot. */
export async function ensureMediaDirs(): Promise<void> {
  await Promise.all([
    mkdir(`${config.mediaDir}/videos`, { recursive: true }),
    mkdir(`${config.mediaDir}/audio`, { recursive: true }),
    mkdir(`${config.mediaDir}/peaks`, { recursive: true }),
  ]);
}

/** Stream an uploaded file to disk without buffering it fully in memory. */
export async function saveUpload(id: string, file: File): Promise<string> {
  const path = mediaPaths.video(id);
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, file);
  return path;
}

/** Remove all media artefacts for a video (best-effort). */
export async function deleteMedia(id: string): Promise<void> {
  await Promise.allSettled([
    rm(mediaPaths.video(id), { force: true }),
    rm(mediaPaths.audio(id), { force: true }),
    rm(mediaPaths.peaks(id), { force: true }),
  ]);
}
