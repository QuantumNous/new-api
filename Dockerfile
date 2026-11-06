FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS builder

WORKDIR /build/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY ./web ./
COPY ./VERSION /build/VERSION
RUN DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat /build/VERSION) bun run build

FROM golang:1.26.10-alpine@sha256:9ce231b28998b32e116927c61aa5c406183061d4f3f2d61b292c88e7f6bdf7ca AS builder2
ENV GO111MODULE=on CGO_ENABLED=0 GOWORK=off

ARG GOPROXY=https://proxy.golang.org,direct
ENV GOPROXY=${GOPROXY}

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

WORKDIR /build

ADD go.mod go.sum ./
# relaykit and tokenkit are local submodules referenced via replace; their
# go.mod files must be present for go mod download to resolve the main module graph.
ADD relaykit/go.mod ./relaykit/go.mod
ADD tokenkit/go.mod ./tokenkit/go.mod
RUN go mod download

COPY . .
COPY --from=builder /build/web/dist ./web/dist
RUN go build -pgo="$(go list -m -f '{{.Dir}}' github.com/Calcium-Ion/moejs)/default.pgo" -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$(cat VERSION)'" -o new-api

FROM debian:bookworm-slim@sha256:f06537653ac770703bc45b4b113475bd402f451e85223f0f2837acbf89ab020a

ARG TARGETARCH

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata libasan8 libstdc++6 wget tar \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates \
    && case "${TARGETARCH:-amd64}" in \
         amd64) copilot_url='https://registry.npmjs.org/@github/copilot-linux-x64/-/copilot-linux-x64-1.0.106.tgz'; copilot_sha='5ba229c2b6f038a8b1ae4627b464bcfa96340717552bafa73805d739bdd264ba' ;; \
         arm64) copilot_url='https://registry.npmjs.org/@github/copilot-linux-arm64/-/copilot-linux-arm64-1.0.106.tgz'; copilot_sha='0f6d694efbe76969f9cb6bd307e2bdcde58c990ff94794e9afb06603d05799fc' ;; \
         *) echo "Unsupported architecture for GitHub Copilot CLI: ${TARGETARCH}" >&2; exit 1 ;; \
       esac \
    && wget -q -O /tmp/copilot.tgz "$copilot_url" \
    && echo "$copilot_sha  /tmp/copilot.tgz" | sha256sum -c - \
    && tar -xzf /tmp/copilot.tgz -C /tmp package/copilot \
    && install -m 0755 /tmp/package/copilot /usr/local/bin/copilot \
    && rm -rf /tmp/copilot.tgz /tmp/package \
    && mkdir -p /data/copilot/profiles /data/copilot/cache /data/copilot/work \
    && chmod 700 /data/copilot /data/copilot/profiles /data/copilot/cache /data/copilot/work

COPY --from=builder2 /build/new-api /
COPY LICENSE NOTICE THIRD-PARTY-LICENSES.md /licenses/
ENV COPILOT_CLI_PATH=/usr/local/bin/copilot
EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/new-api"]
