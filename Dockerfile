# 说明：bun 在容器内拉 npm tarball 时频繁出现 ZlibError，已改为本地预构建前端 dist，
#       本 Dockerfile 仅在容器内编译 Go 二进制并打包运行镜像。
# 本地构建步骤（执行一次或前端变更后执行）：
#   cd web && BUN_CONFIG_REGISTRY=https://registry.npmjs.org/ bun install --no-verify
#   cd web/default && DISABLE_ESLINT_PLUGIN=true VITE_REACT_APP_VERSION=$(cat ../../VERSION) bun run build
#   cd web/classic && VITE_REACT_APP_VERSION=$(cat ../../VERSION) bun run build
# 然后再 docker compose build 即可。

FROM golang:1.26.1-alpine@sha256:2389ebfa5b7f43eeafbd6be0c3700cc46690ef842ad962f6c5bd6be49ed82039 AS builder2
ENV GO111MODULE=on CGO_ENABLED=0
# 切换 Go 模块代理为 goproxy.cn（proxy.golang.org 在境内不可达）
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

WORKDIR /build

ADD go.mod go.sum ./
RUN go mod download

COPY . .
# 本地预构建的前端产物会随构建上下文进入 /build/web/{default,classic}/dist，
# 供 main.go 中的 //go:embed 指令打包进二进制。
RUN go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$(cat VERSION)'" -o new-api

FROM debian:bookworm-slim@sha256:f06537653ac770703bc45b4b113475bd402f451e85223f0f2837acbf89ab020a

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata libasan8 wget \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

COPY --from=builder2 /build/new-api /
COPY LICENSE NOTICE THIRD-PARTY-LICENSES.md /licenses/
EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/new-api"]
