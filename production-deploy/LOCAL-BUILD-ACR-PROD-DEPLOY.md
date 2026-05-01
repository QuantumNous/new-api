# 本地构建镜像 → 阿里云 ACR → 生产发布（含回退）操作文档

## 1. 目标与范围

本文档用于规范以下完整流程：

1. 在本地 Mac 编译前端 + Go 二进制
2. 用编译好的二进制构建 Docker 镜像
3. 推送到阿里云私有镜像仓库（ACR）
4. 在生产服务器（CentOS）无损发布
5. 失败时快速回退

适用环境：

- 本地：macOS（Apple Silicon）
- 生产：Linux/CentOS（x86_64）
- 编排目录：`/opt/production-deploy`

---

## 2. 固定信息

### 2.1 镜像仓库

- Registry：`crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com`
- 命名空间：`ccpg_einwin`
- 仓库名：`new-api`

完整镜像地址格式：

```
crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/new-api:<版本号>
```

### 2.2 本地代码路径

- new-api fork：`/Users/linbiqiu/new-api-test/new-api-fork`

---

## 3. 一次性准备

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
- 生产发布必须使用固定 tag（例如 `1.1.0`），不要用 `latest`
- 发版只改应用镜像，不动数据库和 Redis

---

## 4. 一键构建并推送（推荐）

使用 `build.sh` 脚本一键完成前端构建 → Go编译 → 镜像打包 → ACR推送：

```bash
cd /Users/linbiqiu/new-api-test/new-api-fork/production-deploy
chmod +x build.sh

./build.sh 1.1.0
```

脚本参数：

| 参数 | 说明 |
|------|------|
| `--skip-build` | 跳过本地编译（使用已有的二进制文件） |
| `--skip-push` | 跳过 ACR 推送（只构建镜像不推送） |
| `--skip-classic` | 跳过 classic 前端构建 |
| `--skip-default` | 跳过 default 前端构建 |

示例：

```bash
./build.sh 1.1.0                    # 完整构建 + 推送
./build.sh 1.1.0 --skip-default     # 跳过 default 前端（生产用 classic）
./build.sh 1.1.0 --skip-push        # 只构建不推送
```

---

## 5. 手动构建（分步操作）

如果需要手动控制每一步：

### 5.1 构建 classic 前端

```bash
cd /Users/linbiqiu/new-api-test/new-api-fork/web/classic
bun install && bun run build
```

### 5.2 编译 Go 二进制（linux/amd64）

```bash
cd /Users/linbiqiu/new-api-test/new-api-fork

CGO_ENABLED=0 GOOS=linux GOARCH=amd64 GOEXPERIMENT=greenteagc \
  go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=1.1.0'" \
  -o new-api .
```

验证：

```bash
file new-api
# 应输出: ELF 64-bit LSB executable, x86-64, statically linked
```

### 5.3 构建 Docker 镜像

```bash
cd /Users/linbiqiu/new-api-test/new-api-fork

docker buildx build \
  --platform linux/amd64 \
  -t crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/new-api:1.1.0 \
  -f deploy/Dockerfile.local \
  --load \
  .
```

### 5.4 推送到 ACR

```bash
docker push crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/new-api:1.1.0
```

---

## 6. 生产发布（无损）

### 6.1 发布前备份

```bash
cd /opt/production-deploy

cp .env .env.bak.$(date +%F-%H%M%S)

docker inspect new-api --format '{{.Config.Image}}' > image-old.txt
cat image-old.txt

docker exec postgres pg_dumpall -U root > backup_$(date +%F-%H%M%S).sql
```

### 6.2 登录 ACR 并拉取新镜像

```bash
docker login --username=beacherlin crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com
```

### 6.3 修改 `.env` 镜像版本

编辑 `/opt/production-deploy/.env`：

```env
NEW_API_IMAGE=crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/new-api:1.1.0
```

> 注意：CLIPROXY_API_IMAGE 保持不变，这次只升级 new-api。

### 6.4 拉取并重启（仅 new-api 容器）

```bash
cd /opt/production-deploy

docker compose pull new-api
docker compose up -d new-api --no-deps
```

> `--no-deps` 确保 postgres 和 redis 不会重启。

### 6.5 发布后验证

```bash
docker compose ps
curl -f http://127.0.0.1:3000/api/status
docker logs --tail=100 new-api
```

预期日志中应看到：

```
[SYS] RepairBindGroupSubscriptions: completed
```

---

## 7. 回退流程（失败快速恢复）

### 7.1 恢复旧版本

```bash
cd /opt/production-deploy

# 查看备份的旧镜像地址
cat image-old.txt

# 编辑 .env 改回旧镜像
nano .env

# 拉取旧镜像并重启
docker compose pull new-api
docker compose up -d new-api --no-deps
docker compose ps
curl -f http://127.0.0.1:3000/api/status
```

### 7.2 数据库回退（仅在 DB 被破坏时使用）

```bash
cd /opt/production-deploy

# 停止应用
docker compose stop new-api

# 恢复数据库
cat backup_<timestamp>.sql | docker exec -i postgres psql -U root -d postgres

# 重启应用
docker compose start new-api
```

---

## 8. 数据安全红线

以下操作会影响数据，**禁止**在发版流程中执行：

- `docker compose down -v`
- 删除数据目录：`pg-data`、`redis-data`、`new-api-data`
- 变更数据库/Redis volume 挂载路径

发版只做：

- 改 `.env` 中的 `NEW_API_IMAGE` tag
- `docker compose pull new-api`
- `docker compose up -d new-api --no-deps`

---

## 9. 常见问题

### 9.1 buildx 构建报 `docker.io ... timeout`

原因：本地网络到 Docker Hub 超时。
处理：`deploy/Dockerfile.local` 使用 `docker.m.daocloud.io` 国内镜像前缀。

### 9.2 `docker login` 密码问题

```bash
printf '%s' '<ACR密码>' | docker login --username=beacherlin --password-stdin crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com
```

### 9.3 生产拉取镜像报 `not found`

确认 ACR 仓库中存在对应 tag。在本地先 `docker push` 推送成功后，生产才能 `docker compose pull`。

---

## 10. 版本管理

- 使用语义化版本：`1.0.0` → `1.1.0`（功能版本） → `1.1.1`（修复版本）
- 每次发版前做 `.env` 备份和数据库备份
- 保留至少最近 2~3 个稳定 tag 便于回退
- 当前最新版本：`1.1.0`（飞书 OAuth + 订阅系统）
