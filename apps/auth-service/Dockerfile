# Auth Service Dockerfile — multi-stage build for AWS EC2
# Stage 1: Build
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy root monorepo configs needed for build
COPY package.json tsconfig.base.json ./
COPY apps/auth-service/package.json ./apps/auth-service/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/validation-schemas/package.json ./packages/validation-schemas/

# Install dependencies (production + dev for build step)
RUN npm install --ignore-scripts

# Copy source code
COPY apps/auth-service ./apps/auth-service
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY packages/validation-schemas ./packages/validation-schemas

# Build shared packages first (auth-service depends on them)
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=packages/shared-utils
RUN npm run build --workspace=packages/validation-schemas

# Build auth service
RUN npm run build --workspace=apps/auth-service

# Stage 2: Production image (minimal, no dev dependencies)
FROM node:20-alpine AS production

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only the built output and production deps
COPY --from=builder /app/apps/auth-service/dist ./dist
COPY --from=builder /app/packages/shared-types/dist ./node_modules/@ayurveda/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./node_modules/@ayurveda/shared-utils/dist
COPY --from=builder /app/packages/validation-schemas/dist ./node_modules/@ayurveda/validation-schemas/dist
COPY --from=builder /app/apps/auth-service/package.json ./

# Install production dependencies only
RUN npm install --omit=dev --ignore-scripts

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
