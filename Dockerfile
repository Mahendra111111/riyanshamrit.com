# ─────────────────────────────────────────────────────────
# Multi-stage Dockerfile for all Node.js microservices
# Usage: docker build --build-arg SERVICE=api-gateway -t api-gateway .
#        from the MONOREPO ROOT
# ─────────────────────────────────────────────────────────

ARG SERVICE=api-gateway
ARG NODE_VERSION=22

# ── Stage 1: deps ────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
ARG SERVICE
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy manifests first for layer caching
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY turbo.json ./
COPY tsconfig.base.json ./
COPY apps/${SERVICE}/package.json ./apps/${SERVICE}/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/validation-schemas/package.json ./packages/validation-schemas/

RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 2: builder ─────────────────────────────────────
FROM deps AS builder
ARG SERVICE
WORKDIR /app

# Copy source
COPY packages ./packages
COPY apps/${SERVICE} ./apps/${SERVICE}

# Build shared packages first
RUN pnpm --filter @ayurveda/shared-types build
RUN pnpm --filter @ayurveda/shared-utils build
RUN pnpm --filter @ayurveda/validation-schemas build
# Build the service
RUN pnpm --filter @ayurveda/${SERVICE} build

# ── Stage 3: runner ──────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
ARG SERVICE
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Re-copy manifests for prod install
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY apps/${SERVICE}/package.json ./apps/${SERVICE}/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/validation-schemas/package.json ./packages/validation-schemas/

RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist
COPY --from=builder /app/packages/validation-schemas/dist ./packages/validation-schemas/dist
COPY --from=builder /app/apps/${SERVICE}/dist ./apps/${SERVICE}/dist

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

ENV SERVICE=${SERVICE}

CMD node "apps/${SERVICE}/dist/index.js"
