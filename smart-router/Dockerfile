FROM golang:1.23-bookworm AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/routerd ./cmd/routerd
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/probeworker ./cmd/probeworker

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/routerd /usr/local/bin/routerd
COPY --from=build /out/probeworker /usr/local/bin/probeworker
ENV SMART_ROUTER_LISTEN=0.0.0.0:8080
ENV SMART_ROUTER_ALLOW_NON_LOOPBACK=true
ENV SMART_ROUTER_DATABASE=/data/smart-router.db
VOLUME ["/data"]
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/routerd"]
