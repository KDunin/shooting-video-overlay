FROM oven/bun:alpine

WORKDIR /app

# Infisical CLI — pin version: https://github.com/Infisical/cli/releases
ARG INFISICAL_CLI_VERSION=0.43.60
ARG TARGETARCH
# ffmpeg/ffprobe are used at runtime to probe uploaded videos (see services/ffprobe.ts).
RUN apk add --no-cache curl ca-certificates tar ffmpeg \
  && case "$TARGETARCH" in \
       amd64) INFIS_ARCH=amd64 ;; \
       arm64) INFIS_ARCH=arm64 ;; \
       *) echo "unsupported TARGETARCH=$TARGETARCH (need amd64 or arm64)" >&2 && exit 1 ;; \
     esac \
  && curl -fsSL "https://github.com/Infisical/cli/releases/download/v${INFISICAL_CLI_VERSION}/cli_${INFISICAL_CLI_VERSION}_linux_${INFIS_ARCH}.tar.gz" \
  | tar xz -C /usr/local/bin infisical \
  && chmod +x /usr/local/bin/infisical

# bunfig.toml scopes @kdunin to GitHub Packages via $NPM_TOKEN (same as infra/docker compose build args).
ARG NPM_TOKEN
ENV NPM_TOKEN=${NPM_TOKEN}

COPY . .
RUN chmod +x /app/infra/docker/entrypoint-infisical.sh \
  && bun install --frozen-lockfile

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3001

ENTRYPOINT ["/app/infra/docker/entrypoint-infisical.sh"]
CMD ["bun", "run", "src/index.ts"]
