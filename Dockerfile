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
FROM node:26-alpine
# The base image still ships zlib 1.3.2-r1, which is blocked by
# ALPINE-CVE-2026-4738. The fixed package (zlib 1.4-r0) is published in the
# Alpine v3.24 main repository, so pull it explicitly if the base branch lacks it.
RUN apk upgrade --no-cache \
    && (apk add --no-cache --upgrade 'zlib>=1.4' \
        || (echo "https://dl-cdn.alpinelinux.org/alpine/v3.24/main" >> /etc/apk/repositories \
            && apk update --no-cache \
            && apk add --no-cache --upgrade 'zlib>=1.4')) \
    && apk info -v zlib

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
