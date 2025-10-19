FROM node:20-alpine AS builder

WORKDIR /build

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY web/package.json web/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm config set ignore-scripts false && pnpm install --frozen-lockfile

# Copy source code
COPY ./web .

# Build the frontend with production optimizations
ENV NODE_ENV=production
RUN pnpm run build

# Remove unnecessary files to reduce image size
RUN rm -rf node_modules .git src

FROM golang:alpine AS builder2

ENV GO111MODULE=on \
    CGO_ENABLED=0 \
    GOOS=linux

WORKDIR /build

ADD go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=builder /build/dist ./web/dist

# Build with additional optimizations for smaller binary
RUN go build -ldflags "-s -w -X 'one-api/common.Version=$(cat VERSION)'" -trimpath -o one-api

# Strip binary to reduce size further
RUN apk add --no-cache upx && upx --best --lzma one-api && apk del upx

FROM alpine

RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates tzdata ffmpeg \
    && update-ca-certificates

COPY --from=builder2 /build/one-api /
EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/one-api"]
