# Base: Node 24 with bun
FROM node:24-slim AS base
RUN npm install -g bun
WORKDIR /app

# Dependencies: cached layer, only rebuilds when lockfile changes
FROM base AS deps
COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile

# Build: production build
FROM deps AS build
COPY . .
RUN bun run build

# Production: minimal image with just the build output
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["node", "build/index.js"]

# Dev: full dev environment with hot reload
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
