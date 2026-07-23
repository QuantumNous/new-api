# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24-alpine
ARG GOLANG_IMAGE=golang:1.26.5-alpine
ARG ALPINE_IMAGE=alpine:3.21
ARG POSTGRES_IMAGE=postgres:16.10-alpine
ARG SUB2API_REPOSITORY=https://github.com/Wei-Shaw/sub2api.git
ARG SUB2API_REF=v0.1.160
ARG SUB2API_COMMIT=8bfbc5ca99bf2c0ac96e0f29ffd35eb6aca27e62
ARG GOPROXY=https://goproxy.cn,direct
ARG GOSUMDB=sum.golang.google.cn
ARG NPM_CONFIG_REGISTRY=

FROM alpine/git:2.47.2 AS source
ARG SUB2API_REPOSITORY
ARG SUB2API_REF
ARG SUB2API_COMMIT

RUN git clone --depth 1 --branch "${SUB2API_REF}" "${SUB2API_REPOSITORY}" /src && \
    test "$(git -C /src rev-parse HEAD)" = "${SUB2API_COMMIT}"
COPY model-test.patch /tmp/model-test.patch
RUN git -C /src apply --check /tmp/model-test.patch && \
    git -C /src apply /tmp/model-test.patch

FROM ${NODE_IMAGE} AS frontend-builder
ARG NPM_CONFIG_REGISTRY

WORKDIR /app/frontend
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY --from=source /src/frontend/package.json /src/frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,id=sub2api-pnpm-store,target=/root/.local/share/pnpm/store \
    if [ -n "${NPM_CONFIG_REGISTRY}" ]; then pnpm config set registry "${NPM_CONFIG_REGISTRY}"; fi && \
    pnpm install --frozen-lockfile --prefer-offline

COPY --from=source /src/frontend/ ./
COPY --from=source /src/docs/legal/ /app/docs/legal/
RUN pnpm run build

FROM ${GOLANG_IMAGE} AS backend-builder
ARG VERSION=0.1.160
ARG COMMIT=8bfbc5ca99bf2c0ac96e0f29ffd35eb6aca27e62-model-test
ARG DATE
ARG GOPROXY
ARG GOSUMDB

ENV GOPROXY=${GOPROXY}
ENV GOSUMDB=${GOSUMDB}

RUN apk add --no-cache git ca-certificates tzdata
WORKDIR /app/backend

COPY --from=source /src/backend/go.mod /src/backend/go.sum ./
RUN go mod download
COPY --from=source /src/backend/ ./
COPY --from=frontend-builder /app/backend/internal/web/dist ./internal/web/dist

RUN DATE_VALUE="${DATE:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}" && \
    CGO_ENABLED=0 GOOS=linux go build \
    -tags embed \
    -ldflags="-s -w -X main.Version=${VERSION} -X main.Commit=${COMMIT} -X main.Date=${DATE_VALUE} -X main.BuildType=release" \
    -trimpath \
    -o /app/sub2api \
    ./cmd/server

FROM ${POSTGRES_IMAGE} AS pg-client

FROM ${ALPINE_IMAGE}

LABEL maintainer="Wei-Shaw <github.com/Wei-Shaw>"
LABEL description="Sub2API - AI API Gateway Platform"
LABEL org.opencontainers.image.source="https://github.com/Wei-Shaw/sub2api"

RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    su-exec \
    libpq \
    zstd-libs \
    lz4-libs \
    krb5-libs \
    libldap \
    libedit \
    && rm -rf /var/cache/apk/*

COPY --from=pg-client /usr/local/bin/pg_dump /usr/local/bin/pg_dump
COPY --from=pg-client /usr/local/bin/psql /usr/local/bin/psql
COPY --from=pg-client /usr/local/lib/libpq.so.5* /usr/local/lib/

RUN addgroup -g 1000 sub2api && \
    adduser -u 1000 -G sub2api -s /bin/sh -D sub2api

WORKDIR /app
COPY --from=backend-builder --chown=sub2api:sub2api /app/sub2api /app/sub2api
COPY --from=backend-builder --chown=sub2api:sub2api /app/backend/resources /app/resources
RUN mkdir -p /app/data && chown sub2api:sub2api /app/data

COPY --from=source /src/deploy/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -q -T 5 -O /dev/null http://localhost:${SERVER_PORT:-8080}/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/sub2api"]
