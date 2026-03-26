FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production=false
COPY . .
RUN npx tsc
RUN cp -r src/db/migrations dist/db/migrations
RUN npm prune --production
EXPOSE 3001
CMD ["node", "dist/index.js"]
