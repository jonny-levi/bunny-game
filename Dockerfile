# Use official Node.js runtime as base image (updated to newer LTS)
FROM node:20-alpine3.19

# Install security updates and minimal dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Use the built-in 'node' user (uid 1000) to match K8s securityContext

# Set working directory in container
WORKDIR /app

# Copy backend package.json and package-lock.json (if available)
COPY --chown=node:node backend/package*.json ./backend/

# Switch to non-root user before installing dependencies
USER node

# Install backend dependencies with security flags
RUN cd backend && npm install --only=production --no-audit --no-fund

# Copy backend source code
COPY --chown=node:node backend/ ./backend/

# Copy frontend files
COPY --chown=node:node frontend/ ./frontend/

# Expose port 3000
EXPOSE 3000

# Enhanced health check using curl instead of wget
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set security-focused environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Start the server
CMD ["node", "backend/server.js"]