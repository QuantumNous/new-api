FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app

ARG APP_CONSOLE_ORIGIN=https://console.flatkey.ai
ARG SITE_ORIGIN=https://flatkey.ai
ENV APP_CONSOLE_ORIGIN=${APP_CONSOLE_ORIGIN}
ENV SITE_ORIGIN=${SITE_ORIGIN}
ENV NEXT_PUBLIC_APP_CONSOLE_ORIGIN=${APP_CONSOLE_ORIGIN}
ENV NEXT_PUBLIC_SITE_ORIGIN=${SITE_ORIGIN}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=4000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 4000

CMD ["node", "server.js"]
