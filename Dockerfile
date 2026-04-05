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
# Compile shared server modules imported by socket-setup.js
RUN npx tsc --outDir compiled-server --module nodenext --moduleResolution nodenext --target es2022 --skipLibCheck --declaration false src/lib/server/game/scorecard.ts src/lib/server/game/answer-checker.ts src/lib/server/game/bingo.ts src/lib/server/game/types.ts src/lib/categories.ts

# Production dependencies only
FROM base AS prod-deps
COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile --production

# Production: minimal image with just the build output
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/server.js ./
COPY --from=build /app/socket-setup.js ./
COPY --from=build /app/compiled-server ./src/lib
EXPOSE 3000
CMD ["node", "server.js"]

# Dev: full dev environment with hot reload
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
