# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build essentials and security updates
RUN apk update && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    # Required for node-gyp
    python3 \
    # Required for healthcheck
    curl \
    # Clean up
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install production dependencies with exact versions
# npm v9.6.7 is included in node:18-alpine
RUN npm ci --production --no-audit --no-optional

# Copy application code (respecting .dockerignore)
COPY . .

# Build TypeScript code with production optimizations
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apk update && \
    apk add --no-cache \
    curl \
    tzdata \
    # Clean up
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set secure file permissions
RUN chown -R appuser:appgroup /app && \
    chmod -R 550 /app/dist && \
    chmod -R 550 /app/node_modules && \
    chmod 550 /app/package*.json

# Set production environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048" \
    NODE_ICU_DATA=/app/node_modules/full-icu \
    TZ=UTC

# Expose application port
EXPOSE 3000

# Switch to non-root user
USER appuser

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Enable Node.js clustering and start application
CMD ["node", "--max-old-space-size=2048", "dist/index.js"]