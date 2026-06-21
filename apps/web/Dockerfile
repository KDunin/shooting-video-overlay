FROM oven/bun:alpine

WORKDIR /app

ARG INFISICAL_CLI_VERSION=0.43.60
ARG TARGETARCH
RUN apk add --no-cache curl ca-certificates tar \
  && case "$TARGETARCH" in \
       amd64) INFIS_ARCH=amd64 ;; \
       arm64) INFIS_ARCH=arm64 ;; \
       *) echo "unsupported TARGETARCH=$TARGETARCH (need amd64 or arm64)" >&2 && exit 1 ;; \
     esac \
  && curl -fsSL "https://github.com/Infisical/cli/releases/download/v${INFISICAL_CLI_VERSION}/cli_${INFISICAL_CLI_VERSION}_linux_${INFIS_ARCH}.tar.gz" \
  | tar xz -C /usr/local/bin infisical \
  && chmod +x /usr/local/bin/infisical

ARG NPM_TOKEN
ENV NPM_TOKEN=${NPM_TOKEN}

# install deps from monorepo root manifests
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile

# copy full source and build
COPY . .

ARG API_URL
ENV API_URL=${API_URL}

RUN chmod +x /app/infra/docker/entrypoint-infisical.sh \
  && bun --filter web build

WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["/app/infra/docker/entrypoint-infisical.sh"]
CMD ["bun", "run", ".output/server/index.mjs"]