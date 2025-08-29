FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/oven/bun:latest AS builder

WORKDIR /build
COPY web/package.json .
RUN bun install
COPY ./web .
COPY ./VERSION .
RUN DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat VERSION) bun run build

FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/golang:1.24-alpine AS builder2

ENV GO111MODULE=on \
    CGO_ENABLED=0 \
    GOOS=linux \
    GOPROXY=https://goproxy.cn

WORKDIR /build

ADD go.mod go.sum ./
RUN go mod tidy
RUN go mod download

COPY . .
COPY --from=builder /build/dist ./web/dist
RUN go mod tidy
RUN go build -ldflags "-s -w -X 'one-api/common.Version=$(cat VERSION)'" -o one-api

FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/alpine:latest

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk update \
    && apk upgrade \
    && apk add --no-cache ca-certificates tzdata ffmpeg logrotate dcron curl\
    && update-ca-certificates


    # 复制清理脚本到容器中
COPY cleanup-logs.sh /usr/local/bin/cleanup-logs.sh
RUN chmod +x /usr/local/bin/cleanup-logs.sh

# 复制logrotate配置文件
COPY logrotate.conf /etc/logrotate.d/one-api

# 创建logrotate状态文件目录
RUN mkdir -p /var/lib/logrotate

COPY --from=builder2 /build/one-api /
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/docker-entrypoint.sh"]