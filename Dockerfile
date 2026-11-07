# ---------- build ----------
FROM oven/bun:1-alpine AS build
RUN apk upgrade --no-cache
WORKDIR /app

# Install dependencies from the lockfile first for better layer caching.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
# The Lovable/TanStack config defaults nitro to the cloudflare target; for the
# container we need the plain Node server entry (.output/server/index.mjs).
ENV NITRO_PRESET=node-server
RUN bun run build

# ---------- runtime ----------
# Debian-based image: the Alpine v3.24 node base still ships a blocking zlib CVE
# (ALPINE-CVE-2026-4738) whose fix is not in the v3.24 repository yet.
FROM node:26-trixie-slim
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    NITRO_HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 3000
USER node
CMD ["node", ".output/server/index.mjs"]
