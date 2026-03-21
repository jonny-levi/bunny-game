# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy backend package.json and package-lock.json (if available)
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN cd backend && npm install --production

# Copy backend source code
COPY backend/ ./backend/

# Copy frontend files
COPY frontend/ ./frontend/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bunnyuser -u 1001

# Change ownership of app directory
RUN chown -R bunnyuser:nodejs /app
USER bunnyuser

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the server
CMD ["node", "backend/server.js"]