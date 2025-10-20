FROM oven/bun:1-alpine AS builder

WORKDIR /build

# Copy package files
COPY web/package.json web/bun.lockb* ./

# Install dependencies with Bun (much faster than pnpm/npm)
RUN bun install --frozen-lockfile

# Copy source code
COPY ./web .

# Build the frontend with production optimizations
ENV NODE_ENV=production
RUN bun run build

# Remove unnecessary files to reduce image size
RUN rm -rf node_modules .git src

FROM golang:alpine AS builder2

ENV GO111MODULE=on \
    CGO_ENABLED=0 \
    GOOS=linux \
    GOCACHE=/root/.cache/go-build

WORKDIR /build

# Cache Go dependencies
ADD go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

COPY . .
COPY --from=builder /build/dist ./web/dist

# Build with optimizations and parallel compilation
RUN --mount=type=cache,target=/root/.cache/go-build \
    go build -ldflags "-s -w -X 'one-api/common.Version=$(cat VERSION)'" -trimpath -o one-api

# Use faster UPX compression (--fast instead of --best --lzma)
# This is 10x faster while still achieving good compression
RUN apk add --no-cache upx && upx --fast one-api && apk del upx

FROM alpine

RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates tzdata ffmpeg \
    && update-ca-certificates

COPY --from=builder2 /build/one-api /
EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/one-api"]
