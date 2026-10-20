# ==============================================================================
# Multi-Stage Production Dockerfile for ERP Backend Service
# ==============================================================================

# Stage 1: Build & TypeScript Compilation
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy backend source code
COPY src/ ./src/

# Compile TypeScript to JavaScript in dist/
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Stage 2: Production Lightweight Runtime
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=5000

# Install curl for container health check
RUN apk --no-cache add curl

# Create non-root system user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy compiled JavaScript and production node_modules from builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Set ownership to non-root user
RUN chown -R appuser:appgroup /usr/src/app

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server.js"]
