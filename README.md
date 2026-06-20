# Shooting Video Overlay

Self-hosted video analysis for IPSC / practical-shooting training (à la *Shooters Global*).
Upload a stage video → the audio is analysed to auto-detect the **timer beep** and every **shot** →
splits, first-shot and total time are computed and shown as a **live overlay** on the video. A fast
manual-correction editor lets you fix any mis-detections; results recompute instantly.

## How it works

```
Browser (TanStack Start)  ──upload──►  API (Elysia/Bun)  ──row + file──►  Postgres + /media volume
        ▲  live overlay                     │  enqueue job                        ▲
        │  waveform editor                   ▼                                     │ markers
        └──────────────  poll status ◄── analysis_jobs queue ◄── Analyzer worker (Python)
                                              (FOR UPDATE SKIP LOCKED)   ffmpeg → numpy/scipy
```

- **Beep detection** — narrow-band tone detection with a scale-invariant prominence gate.
- **Shot detection** — spectral-flux onset detection (default) or envelope-peak (fallback), with a
  refractory window so fast splits stay distinct and echoes don't double-trigger. Detections carry a
  confidence score; low-confidence shots are flagged in the UI for review.
- **Splits / first-shot / total** are *computed* from markers (never stored), so every manual edit
  recomputes instantly. The same `computeResults` selector runs in the browser and the API.

See [the full architecture & plan](.claude/plans/i-want-to-build-transient-dawn.md) for trade-offs,
the audio-approach comparison, and the roadmap (shooter tracking, draw/reload detection, etc.).

## Stack

| Part | Tech |
|---|---|
| Web | TanStack Start (React 19), Tailwind 4, shadcn-compatible UI, canvas overlay + waveform |
| API | Elysia (Bun) + Eden type-safe client, Drizzle ORM |
| Analyzer | Python 3.12, ffmpeg, numpy/scipy/soundfile |
| Data | Postgres 16 (also the job queue); media on a shared Docker volume |

## Quick start (Docker)

```bash
cp .env.example .env
# Set NPM_TOKEN to a GitHub Packages token (needed for the private @kdunin component library).
docker compose up --build
```

Then open <http://localhost:3000>. Drop a video, wait for analysis, correct any mistakes, review.

## Local development

```bash
cp .env.example .env
bun install                 # requires NPM_TOKEN in your env for @kdunin/component-library
docker compose up postgres  # or point DATABASE_URL at your own Postgres
bun run dev                 # web :3000, api :3001
```

Analyzer (separate process / venv, needs ffmpeg on PATH):

```bash
python3 -m venv .venv-analyzer
.venv-analyzer/bin/pip install -e "apps/analyzer[dev]"
DATABASE_URL=postgres://postgres:postgres@localhost:5432/guns \
MEDIA_DIR=./.media \
  .venv-analyzer/bin/python -m src.worker      # run from apps/analyzer
```

## Tests

```bash
# Shared split-computation logic
cd packages/shared && bun test

# Analyzer DSP + pipeline (DB tests auto-skip without DATABASE_URL)
cd apps/analyzer && PYTHONPATH=. pytest -q
```

## Auth

Single-user by default (no login). Logto is fully scaffolded — set `AUTH_ENABLED=true` and the
`LOGTO_*` vars to enable multi-user auth.

## Notes

- Uploaded videos are stored on the `media` volume (not in the DB); set `MAX_UPLOAD_BYTES` to cap size.
- Re-running detection clears prior *auto* markers but preserves your manual edits.
