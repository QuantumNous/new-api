# Pinned to the same Go version the root project builds with, so the two modules
# never drift onto different toolchains.
FROM golang:1.26.1-alpine AS builder

WORKDIR /src

# Module mirror, for networks that cannot reach proxy.golang.org directly:
#   docker compose -f docker-compose.sidecar.yml build --build-arg GOPROXY=https://goproxy.cn,direct
ARG GOPROXY
ENV GOPROXY=${GOPROXY:-https://proxy.golang.org,direct}

# go.sum is committed, so dependencies resolve deterministically and this layer
# stays cached until the module graph actually changes. `go mod tidy` must not run
# here: it would rewrite the graph at build time, making the image non-reproducible.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# CGO stays disabled: the SQLite driver is pure Go, so the binary is static.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/proxy .

FROM alpine:3.20

RUN adduser -D -u 10001 proxy \
    && mkdir -p /var/lib/proxy/spool \
    && chown -R proxy:proxy /var/lib/proxy

COPY --from=builder /out/proxy /usr/local/bin/proxy

USER proxy
# Matches `listen: ":3001"` in the config files.
EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/proxy"]
CMD ["-config", "/etc/proxy/config.yaml"]
