FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS builder

WORKDIR /build/web

# 1. 复制依赖清单
COPY web/package.json web/bun.lock ./

# 2. 设置国内镜像源（提升下载稳定性）
RUN bun config set registry https://registry.npmmirror.com

# 3. 清理可能损坏的本地缓存
RUN bun cache clear

# 4. 带重试机制安装依赖（最多 3 次）
RUN for i in 1 2 3; do \
        bun install --frozen-lockfile && break || { \
            echo "Attempt $i failed, retrying in 5 seconds..."; \
            sleep 5; \
        }; \
    done

# 5. 复制前端源码
COPY ./web ./
# 6. 复制版本文件
COPY ./VERSION /build/VERSION
# 7. 构建前端
RUN DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat /build/VERSION) bun run build

# ==================== 后端构建（不变） ====================
FROM golang:1.26.1-alpine@sha256:2389ebfa5b7f43eeafbd6be0c3700cc46690ef842ad962f6c5bd6be49ed82039 AS builder2
ENV GO111MODULE=on CGO_ENABLED=0 GOWORK=off

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

WORKDIR /build

ADD go.mod go.sum ./
ADD relaykit/go.mod ./relaykit/go.mod
RUN go mod download

COPY . .
COPY --from=builder /build/web/dist ./web/dist
RUN go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$(cat VERSION)'" -o new-api

# ==================== 最终镜像 ====================
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
