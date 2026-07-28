FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY migrations ./migrations
COPY src ./src

ENV NODE_ENV=production
EXPOSE 8787
USER node
CMD ["node", "src/server.mjs"]
