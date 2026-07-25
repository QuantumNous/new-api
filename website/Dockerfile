FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app

ARG APP_CONSOLE_ORIGIN=https://console.flatkey.ai
ARG ROUTER_ORIGIN=https://router.flatkey.ai
ARG SITE_ORIGIN=https://flatkey.ai
ARG COOKIE_SESSION_DOMAIN=
ARG BLOGGER_API_URL=https://blogger-api-528088078482.us-central1.run.app
ARG BLOGGER_SITE_SLUG=flatkey
ENV APP_CONSOLE_ORIGIN=${APP_CONSOLE_ORIGIN}
ENV ROUTER_ORIGIN=${ROUTER_ORIGIN}
ENV SITE_ORIGIN=${SITE_ORIGIN}
ENV COOKIE_SESSION_DOMAIN=${COOKIE_SESSION_DOMAIN}
ENV NEXT_PUBLIC_APP_CONSOLE_ORIGIN=${APP_CONSOLE_ORIGIN}
ENV NEXT_PUBLIC_ROUTER_ORIGIN=${ROUTER_ORIGIN}
ENV NEXT_PUBLIC_SITE_ORIGIN=${SITE_ORIGIN}
ENV BLOGGER_API_URL=${BLOGGER_API_URL}
ENV BLOGGER_SITE_SLUG=${BLOGGER_SITE_SLUG}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=4000
ARG COOKIE_SESSION_DOMAIN=
ENV COOKIE_SESSION_DOMAIN=${COOKIE_SESSION_DOMAIN}

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 4000

CMD ["node", "server.js"]
