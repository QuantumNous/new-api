FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS builder

ARG NPM_REGISTRY=https://registry.npmmirror.com

WORKDIR /build/web
COPY web/package.json web/bun.lock ./
COPY web/default/package.json ./default/package.json
COPY web/classic/package.json ./classic/package.json
RUN bun install --frozen-lockfile --registry "$NPM_REGISTRY"
COPY ./web/default ./default
COPY ./VERSION /build/VERSION
RUN cd default && \
    rm -rf dist node_modules/.cache .rsbuild .rspack-cache && \
    DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat /build/VERSION) bun run build && \
    find dist/static/js -maxdepth 1 -type f -name 'index.*.js' -print

FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS builder-classic

ARG NPM_REGISTRY=https://registry.npmmirror.com

WORKDIR /build/web
COPY web/package.json web/bun.lock ./
COPY web/default/package.json ./default/package.json
COPY web/classic/package.json ./classic/package.json
RUN bun install --frozen-lockfile --registry "$NPM_REGISTRY"
COPY ./web/classic ./classic
COPY ./VERSION /build/VERSION
RUN cd classic && \
    rm -rf dist node_modules/.cache .rsbuild .rspack-cache && \
    VITE_REACT_APP_VERSION=$(cat /build/VERSION) bun run build

FROM golang:1.26.1-alpine@sha256:2389ebfa5b7f43eeafbd6be0c3700cc46690ef842ad962f6c5bd6be49ed82039 AS builder2
ENV GO111MODULE=on CGO_ENABLED=0
ARG GOPROXY=https://goproxy.cn,direct
ARG GOSUMDB=sum.golang.google.cn
ENV GOPROXY=${GOPROXY} GOSUMDB=${GOSUMDB}

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

WORKDIR /build

ADD go.mod go.sum ./
COPY privacy-filter/go.mod ./privacy-filter/go.mod
RUN go mod download

COPY . .
RUN rm -rf ./web/default/dist ./web/classic/dist
COPY --from=builder /build/web/default/dist ./web/default/dist
COPY --from=builder-classic /build/web/classic/dist ./web/classic/dist
RUN go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$(cat VERSION)'" -o new-api

FROM debian:bookworm-slim@sha256:f06537653ac770703bc45b4b113475bd402f451e85223f0f2837acbf89ab020a

ARG APT_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian
ARG APT_SECURITY_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian-security

RUN set -eux; \
    files="$(find /etc/apt -type f \( -name '*.sources' -o -name 'sources.list' \))"; \
    sed -i \
        -e "s#http://deb.debian.org/debian-security#${APT_SECURITY_MIRROR}#g" \
        -e "s#http://security.debian.org/debian-security#${APT_SECURITY_MIRROR}#g" \
        -e "s#http://deb.debian.org/debian#${APT_MIRROR}#g" \
        -e "s#http://security.debian.org/debian#${APT_MIRROR}#g" \
        $files; \
    apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata libasan8 wget \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

COPY --from=builder2 /build/new-api /
COPY LICENSE NOTICE THIRD-PARTY-LICENSES.md /licenses/
EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/new-api"]
