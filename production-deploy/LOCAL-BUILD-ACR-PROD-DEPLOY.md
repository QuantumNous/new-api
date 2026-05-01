# 本地构建镜像 → 阿里云 ACR → 生产发布（含回退）操作文档

## 1. 目标与范围

本文档用于规范以下完整流程：

1. 在本地 Mac 构建 `new-api` 和 `CLIProxyAPI` 的 Linux 镜像
2. 推送到阿里云私有镜像仓库（ACR）
3. 在生产服务器（CentOS）无损发布
4. 失败时快速回退

适用环境：

- 本地：macOS（Apple Silicon）
- 生产：Linux/CentOS（x86_64）
- 编排目录：`/opt/production-deploy`

---

## 2. 固定信息（当前项目）

### 2.1 镜像仓库

- Registry：`crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com`
- 命名空间：`ccpg_einwin`

推荐仓库名：

- `new-api`
- `cliproxyapi`

最终镜像示例：

- `crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/new-api:1.0.1`
- `crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/cliproxyapi:1.0.1`

### 2.2 本地代码路径

- `new-api`：`/Users/linbiqiu/new-api-test/new-api`
- `CLIProxyAPI`：`/Users/linbiqiu/trae/源码部署/CLIProxyAPI-main`

---

## 3. 一次性准备（本地）

### 3.1 登录 ACR

```bash
docker login --username=beacherlin crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com
```

### 3.2 初始化 buildx（仅首次）

```bash
docker buildx create --use --name multiarch-builder || true
docker buildx inspect --bootstrap
```

### 3.3 关键原则

- 本地构建必须指定：`--platform linux/amd64`
- 生产发布必须使用固定 tag（例如 `1.0.1`），不要用 `latest`

---

## 4. 构建并推送 new-api

在本地执行：

```bash
cd /Users/linbiqiu/new-api-test/new-api

docker buildx build \
  --platform linux/amd64 \
  -t crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/new-api:1.0.1 \
  -f deploy/Dockerfile.optimized \
  . \
  --push
```

说明：当前 `deploy/Dockerfile.optimized` 已采用国内镜像源前缀，避免 Docker Hub 超时。

---

## 5. 构建并推送 CLIProxyAPI

在本地执行：

```bash
cd "/Users/linbiqiu/trae/源码部署/CLIProxyAPI-main"

docker buildx build \
  --platform linux/amd64 \
  -t crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/cliproxyapi:1.0.1 \
  . \
  --push
```

说明：当前 `CLIProxyAPI` Dockerfile 已改为国内镜像源，并设置了 Go 依赖下载加速（GOPROXY/GOSUMDB）。

---

## 6. 生产发布（无损）

### 6.1 首次发布前备份（建议每次发版前做）

```bash
cd /opt/production-deploy

cp .env .env.bak.$(date +%F-%H%M%S)
cp docker-compose.yml docker-compose.yml.bak.$(date +%F-%H%M%S)

docker inspect new-api --format '{{.Config.Image}}' > image-new-api.bak.$(date +%F-%H%M%S).txt
docker inspect cliproxyapi --format '{{.Config.Image}}' > image-cliproxyapi.bak.$(date +%F-%H%M%S).txt
```

### 6.2 更新 `.env` 镜像标签

编辑 `/opt/production-deploy/.env`：

```env
NEW_API_IMAGE=crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/new-api:1.0.1
CLIPROXY_API_IMAGE=crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/cliproxyapi:1.0.1
```

### 6.3 拉取并发布（仅应用容器）

```bash
cd /opt/production-deploy

docker login --username=beacherlin crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com
docker compose pull new-api cliproxyapi
docker compose up -d new-api cliproxyapi --no-deps
```

### 6.4 发布后验证

```bash
docker compose ps
curl -f http://127.0.0.1:3000/api/status
docker logs --tail=200 new-api
docker logs --tail=200 cliproxyapi
```

---

## 7. 回退流程（失败快速恢复）

### 7.1 修改 `.env` 回旧版本

示例回退到 `1.0.0`：

```env
NEW_API_IMAGE=crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/new-api:1.0.0
CLIPROXY_API_IMAGE=crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/cliproxyapi:1.0.0
```

### 7.2 执行回退发布

```bash
cd /opt/production-deploy

docker compose pull new-api cliproxyapi
docker compose up -d new-api cliproxyapi --no-deps
docker compose ps
```

---

## 8. 数据安全红线（必须遵守）

以下操作会影响数据，禁止在发版流程中执行：

- `docker compose down -v`
- 删除数据目录：`pg-data`、`redis-data`、`new-api-data`
- 变更数据库/Redis volume 挂载路径

发版只做：

- 改应用镜像 tag
- `pull` + `up -d --no-deps`

---

## 9. 常见问题与处理

### 9.1 `failed to resolve source metadata ... docker.io ... timeout`

原因：本地网络到 Docker Hub 超时。
处理：

- Dockerfile 使用国内镜像源前缀（已处理）
- Go 依赖使用 GOPROXY（已处理）

### 9.2 `docker login ... password is required`

使用 `--password-stdin`：

```bash
printf '%s' '<ACR密码>' | docker login --username=beacherlin --password-stdin crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com
```

---

## 10. 推荐发版节奏

- 使用语义化版本：`1.0.1`、`1.0.2`、`1.1.0`
- 每次发版前做 `.env` 备份
- 保留至少最近 2~3 个稳定 tag 便于回退
