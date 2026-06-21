#!/bin/sh
set -eu

echo "[api] Running database migrations..."
bun run --cwd /app/packages/db db:migrate

echo "[api] Starting server..."
exec bun run --cwd /app/apps/api src/index.ts
