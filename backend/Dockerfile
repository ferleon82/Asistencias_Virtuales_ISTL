# Base
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Desarrollo
FROM base AS development
ENV NODE_ENV=development
COPY . .
RUN pnpm exec prisma generate
EXPOSE 3000
CMD ["pnpm", "run", "dev"]

# Build
FROM base AS builder
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build

# Dependencias productivas
FROM builder AS production-deps
RUN pnpm prune --prod

# Produccion
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
