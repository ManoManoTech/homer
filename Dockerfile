# Stage 1: Build dependencies
FROM node:24-alpine AS dependencies

WORKDIR /app

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Stage 2: Build application
FROM node:24-alpine AS builder

WORKDIR /app

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files and TypeScript configs
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src ./src

# You need to override the config directory with your own config 
# when building your own image. Also, copy your own plugins directory.
COPY config ./config

# Build the application
RUN pnpm build

# Stage 3: Production image
FROM node:24-alpine AS production

# Install tini for proper signal handling and zombie process reaping
# Tini is recommended by Docker and is part of the Docker init standard
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -g 1001 -S homer && \
    adduser -S homer -u 1001

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=homer:homer /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=homer:homer /app/dist ./dist
COPY --from=builder --chown=homer:homer /app/package.json ./package.json

# Use non-root user
USER homer

EXPOSE 3000

# Use tini as the init process to handle signals and reap zombies
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/index.js"]
