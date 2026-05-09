FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production=false
COPY backend/ ./
RUN npx tsc
RUN cp -r src/db/migrations dist/db/migrations
RUN npm prune --production
COPY --from=frontend-build /frontend/dist ./public
EXPOSE 3001
CMD ["node", "dist/index.js"]
