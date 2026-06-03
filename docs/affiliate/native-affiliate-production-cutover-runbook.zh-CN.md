# 原生分销生产镜像切换 Runbook

更新日期：2026-06-03

适用分支：`feature/native-affiliate-minimal`

## 适用范围

本 runbook 用于把当前仓库的原生分销二开功能从本地 dev 模式切换到生产或 staging 发布链路。核心目标是避免误以为官方 `calciumion/new-api:latest` 已包含本仓库二开代码。

本 runbook 不包含生产密码、DSN、cookie、token、完整手机号或真实生产地址。执行时只能把这些敏感值放在部署环境的 secret 管理、未提交的 `.env`、宿主机环境变量或受控运维平台中。

## 当前事实

- 本地 dev compose 的 `new-api` 应使用本仓库源码构建 `new-api:dev`，配置文件为 `docker-compose.dev.yml`，镜像构建入口为 `Dockerfile.dev`。
- `Dockerfile.dev` 是后端开发镜像，只放置 default/classic 前端占位 dist；实际前端页面由 WSL 内 `scripts/dev-web-tmux.sh` 启动的 `5173` default 和 `5174` classic Rsbuild dev server 提供。
- 生产 `Dockerfile` 会分别构建 `web/default` 与 `web/classic`，再把两个 dist 嵌入 Go 应用镜像。
- 根目录 `docker-compose.yml` 是上游样例。按原样使用时，`services.new-api.image` 为 `calciumion/new-api:latest`，不会包含本仓库的分销路由、分销前端页面、缓存规避和日志脱敏改动。
- dev compose 中 Redis/PostgreSQL 使用官方基础设施镜像，不代表应用代码来自官方 latest；应用代码是否包含二开只取决于 `new-api` 服务使用的应用镜像。

## 镜像策略

生产或 staging 不使用浮动 `latest` 作为二开应用镜像版本。每次发布都从当前仓库根目录构建不可变 tag，并记录 commit。

推荐 tag 格式：

```bash
APP_TAG="$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD)"
APP_IMAGE="new-api-rain:${APP_TAG}"
```

本机构有私有镜像仓库时，使用同样的不可变 tag：

```bash
REGISTRY_IMAGE="registry.example.invalid/new-api-rain:${APP_TAG}"
```

构建本地生产镜像：

```bash
git status --short --branch
git log --oneline -1
APP_TAG="$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD)"
APP_IMAGE="new-api-rain:${APP_TAG}"
timeout 1800s docker build --pull -t "${APP_IMAGE}" .
```

如果使用 buildx：

```bash
timeout 1800s docker buildx build --load -t "${APP_IMAGE}" .
```

如需推送私有仓库，应先完成本地 smoke、漏洞扫描和权限确认，再执行：

```bash
docker tag "${APP_IMAGE}" "${REGISTRY_IMAGE}"
docker push "${REGISTRY_IMAGE}"
```

## Compose override

不要直接编辑并提交包含真实生产 secret 的 compose 文件。推荐复制根目录示例：

```bash
cp docker-compose.prod.local.example.yml docker-compose.prod.local.yml
```

本地或生产宿主机使用未提交的环境变量指定镜像：

```bash
export NEW_API_IMAGE="new-api-rain:20260603-1200-abcdef12"
docker compose -f docker-compose.yml -f docker-compose.prod.local.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.prod.local.yml up -d new-api
```

如果生产环境已有独立 compose、Kubernetes、面板或运维平台，等价要求是：应用服务镜像必须改成本仓库 `Dockerfile` 构建出的不可变 tag，不再使用官方 `calciumion/new-api:latest` 作为包含二开功能的应用镜像。

## 发布前检查

- 确认当前分支和 commit：`git status --short --branch`、`git log --oneline -8`。
- 确认目标镜像 tag 记录了 commit，不使用浮动 `latest`。
- 确认生产 PostgreSQL 已备份，并记录备份时间、备份方式和可恢复路径。
- 确认旧应用镜像 tag 或旧部署版本已记录，可用于回滚。
- 确认生产环境变量、PostgreSQL、Redis、日志目录、反向代理、HTTPS、域名、备份和告警配置来自生产环境，不复用本地 dev volume、本地 dump 或测试账号。
- 确认 `Dockerfile` 会构建 default/classic 前端 dist，而不是只发布后端二进制。
- 确认外部验收仍按 `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md` 执行，本地 WSL smoke 不能替代 staging/生产验收。

## 从 dev 切回生产模式

如果生产和本地开发在同一台机器上，先确认不会误停真实生产服务。只在明确使用本地 dev compose 时执行：

```bash
timeout 60s docker compose -f docker-compose.dev.yml down
```

生产切换步骤：

```bash
git status --short --branch
git log --oneline -1
APP_TAG="$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD)"
export NEW_API_IMAGE="new-api-rain:${APP_TAG}"
timeout 1800s docker build --pull -t "${NEW_API_IMAGE}" .
docker compose -f docker-compose.yml -f docker-compose.prod.local.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.prod.local.yml up -d new-api
docker inspect new-api --format '{{.Config.Image}}'
```

生产服务启动后，先做不带登录态的基础 smoke：

```bash
timeout 30s curl -sS http://127.0.0.1:3000/api/status
timeout 30s curl -i http://127.0.0.1:3000/api/affiliate/team
```

未登录访问 `/api/affiliate/team` 应返回 401，不应返回 `Invalid URL` 404。登录态 smoke 必须从受控 secret 读取账号信息，输出只保留 HTTP code、`success` 和必要的脱敏计数，不输出密码、cookie、session 或完整响应体。

登录后至少验证：

- `GET /api/affiliate/status` 返回当前账号分销状态。
- `GET /api/affiliate/team` 返回 200，且关系树数据符合预期。
- 分销商中心页面能加载关系树、摘要、佣金和 scoped 使用日志。
- 管理端分销规则页、佣金页、结算页能打开，权限符合管理员视角。
- scoped 使用日志和 CSV 不泄漏 channel、token、IP、request id、upstream request id。
- 浏览器 Network 不再命中旧 404/401 缓存，必要时确认 API 响应或前端请求具备 no-cache 策略。

## 回滚

回滚前先记录当前失败镜像 tag、容器日志和关键错误，避免丢失排障证据。

回滚应用镜像：

```bash
export NEW_API_IMAGE="new-api-rain:<previous-known-good-tag>"
docker compose -f docker-compose.yml -f docker-compose.prod.local.yml up -d new-api
docker inspect new-api --format '{{.Config.Image}}'
```

如果本次发布只新增 sidecar 表或索引，旧应用一般可以忽略这些对象。不要在没有 schema impact 和备份恢复方案时直接删除生产 sidecar 表。涉及数据回滚时，以 PostgreSQL 备份恢复方案为准，并先在 staging 或只读恢复环境验证。

## 残留风险

- 本 runbook 只能保证镜像来源、compose 覆盖和基础 smoke 的治理闭环，不能替代真实充值、真实 relay 消耗、退款、周期结算、灰度和外部只读归档验收。
- 如果生产部署平台不是 Docker Compose，应把本 runbook 的镜像 tag、secret 隔离、前端 bundle、备份和回滚要求映射到对应平台。
- 如果反向代理或 CDN 对 `/api/*` 做了缓存，仍可能复现旧 404/401 或敏感 JSON 缓存问题，发布验收必须检查真实入口的 Network 和响应头。
