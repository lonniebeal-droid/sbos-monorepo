# syntax=docker/dockerfile:1
# Multi-stage build for @sbos/api using Turborepo pruning for optimal caching.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# OpenSSL + CA certs are required by the Prisma query engine at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# 1) Prune the monorepo down to @sbos/api and its workspace dependencies.
FROM base AS pruner
RUN pnpm add -g turbo@2.10.6
COPY . .
RUN turbo prune @sbos/api --docker

# 2) Install dependencies (cached on the pruned lockfile) and build.
FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@sbos/api

# 3) Minimal runtime image.
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app .
EXPOSE 4000
# Apply pending migrations, then start the API.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=packages/database/prisma/schema.prisma && node apps/api/dist/main.js"]
