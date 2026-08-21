# syntax=docker/dockerfile:1
# Multi-stage build for @sbos/api using Turborepo pruning for optimal caching.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
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
ENV HOME=/tmp
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nodeuser
COPY --from=builder --chown=nodeuser:nodejs /app .
USER nodeuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations from the database workspace, then start the API.
CMD ["sh", "-c", "pnpm --filter @sbos/database prisma:deploy && node apps/api/dist/main.js"]
