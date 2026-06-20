#!/bin/sh
set -eu

if [ -z "${INFISICAL_MACHINE_CLIENT_ID:-}" ] || [ -z "${INFISICAL_MACHINE_CLIENT_SECRET:-}" ] || [ -z "${INFISICAL_PROJECT_ID:-}" ]; then
  echo "[infisical] Missing required env vars. Need INFISICAL_MACHINE_CLIENT_ID, INFISICAL_MACHINE_CLIENT_SECRET, INFISICAL_PROJECT_ID." >&2
  exit 1
fi

INFISICAL_SECRET_ENV="${INFISICAL_SECRET_ENV:-dev}"
INFISICAL_API_URL="${INFISICAL_API_URL:-https://app.infisical.com}"

export INFISICAL_TOKEN="$(infisical login \
  --method=universal-auth \
  --client-id="$INFISICAL_MACHINE_CLIENT_ID" \
  --client-secret="$INFISICAL_MACHINE_CLIENT_SECRET" \
  --domain="$INFISICAL_API_URL" \
  --plain \
  --silent)"

exec infisical run \
  --token "$INFISICAL_TOKEN" \
  --projectId "$INFISICAL_PROJECT_ID" \
  --env "$INFISICAL_SECRET_ENV" \
  --domain "$INFISICAL_API_URL" \
  -- "$@"
