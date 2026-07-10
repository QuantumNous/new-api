FROM oven/bun:1

ARG GO_VERSION=1.26.1
ARG GO_DOWNLOAD_URL=https://mirrors.aliyun.com/golang/go${GO_VERSION}.linux-amd64.tar.gz

ENV TZ=Asia/Shanghai \
    GO111MODULE=on \
    GOPROXY=https://goproxy.cn,direct \
    GOSUMDB=sum.golang.google.cn \
    GOROOT=/usr/local/go \
    PATH=/usr/local/go/bin:/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache \
    npm_config_registry=https://registry.npmmirror.com \
    npm_config_disturl=https://npmmirror.com/dist \
    npm_config_electron_mirror=https://npmmirror.com/mirrors/electron/ \
    PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl git bash xz-utils; \
    rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    curl -fsSL "${GO_DOWNLOAD_URL}" -o /tmp/go.tgz; \
    rm -rf /usr/local/go; \
    tar -C /usr/local -xzf /tmp/go.tgz; \
    rm -f /tmp/go.tgz; \
    go version; \
    bun --version

RUN set -eux; \
    mkdir -p /root/.bun/install/cache; \
    cat <<'EOF' > /root/.bunfig.toml
[install]
registry = "https://registry.npmmirror.com"
cache = true
EOF

WORKDIR /workspace

CMD ["sleep", "infinity"]
