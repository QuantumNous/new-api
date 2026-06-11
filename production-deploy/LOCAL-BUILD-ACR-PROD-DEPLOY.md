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
- 生产：Linux/CentOS（x86_64），Docker 需要 `sudo`
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

## 3. 一次性准备（本地 Mac）

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
- **生产服务器所有 docker 命令需要 `sudo`**

---

## 4. 一键构建并推送（推荐，本地 Mac 执行）

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

### 常用场景速查

| 场景 | 命令 | 耗时 |
|------|------|------|
| 全量构建（前后端都改了） | `./build.sh <版本>` | 慢（~5-10min） |
| **仅改了后端 Go 代码** | `./build.sh <版本> --skip-classic --skip-default` | 快（~2-3min） |
| 仅改了 classic 前端 | `./build.sh <版本> --skip-default --skip-build` → 手动先 build classic | 中等 |
| 改了 docker 配置 | `./build.sh <版本> --skip-classic --skip-default --skip-build` | 最快 |

---

## 5. 手动构建（分步操作，本地 Mac 执行）

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

## 6. 生产发布（无损，生产服务器执行）

> **注意：生产服务器所有 docker/docker compose 命令需要加 `sudo`。**

### 6.1 发布前备份

```bash
cd /opt/production-deploy

sudo cp .env .env.bak.$(date +%F-%H%M%S)

sudo docker inspect new-api --format '{{.Config.Image}}' > image-old.txt
cat image-old.txt

sudo docker exec postgres pg_dumpall -U root > backup_$(date +%F-%H%M%S).sql
```

### 6.2 登录 ACR

```bash
sudo docker login --username=beacherlin crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com
```

### 6.3 修改 `.env` 镜像版本

```bash
sudo nano /opt/production-deploy/.env
```

修改这一行：

```env
NEW_API_IMAGE=crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com/ccpg_einwin/new-api:1.1.0
```

> CLIPROXY_API_IMAGE 保持不变，这次只升级 new-api。

### 6.4 拉取并重启（仅 new-api 容器）

```bash
cd /opt/production-deploy

sudo docker compose pull new-api
sudo docker compose up -d new-api --no-deps
```

> `--no-deps` 确保 postgres 和 redis 不会重启。

### 6.5 发布后验证

```bash
sudo docker compose ps
curl -f http://127.0.0.1:3000/api/status
sudo docker logs --tail=100 new-api
```

预期日志中应看到：

```
[SYS] RepairBindGroupSubscriptions: completed
```

### 6.6 手动触发飞书用量统计推送

飞书统计推送默认由服务内置定时任务自动执行：

- 每天凌晨 3:00：推送前一天日报
- 每周一凌晨 3:30：推送上周周报
- 每月 1 号凌晨 4:00：推送上月月报

如需补数或验证生产推送，可使用管理员登录态/API Token 手动触发。接口会复用定时任务同一套逻辑，并先清空对应周期的 3 张多维表格，再写入最新统计数据。

后台 API Token 调用时需要同时传入 `New-Api-User`，值为该管理员用户 ID。生产当前管理员用户 ID 为 `1`。

```bash
# 手动推送昨天日报
curl -X POST http://127.0.0.1:3000/api/user/feishu/stats/push/daily \
  -H "Authorization: Bearer <管理员token>" \
  -H "New-Api-User: 1"

# 手动推送上周周报
curl -X POST http://127.0.0.1:3000/api/user/feishu/stats/push/weekly \
  -H "Authorization: Bearer <管理员token>" \
  -H "New-Api-User: 1"

# 手动推送上月月报
curl -X POST http://127.0.0.1:3000/api/user/feishu/stats/push/monthly \
  -H "Authorization: Bearer <管理员token>" \
  -H "New-Api-User: 1"
```

公网域名调用示例：

```bash
curl -X POST https://airouter.einwin.com/api/user/feishu/stats/push/daily \
  -H "Authorization: Bearer <管理员token>" \
  -H "New-Api-User: 1"
```

成功响应示例：

```json
{
  "success": true,
  "message": "",
  "data": {
    "period": "daily",
    "label": "2026-06-10",
    "start_timestamp": 1781020800,
    "end_timestamp": 1781107199,
    "start_time": "2026-06-10T00:00:00+08:00",
    "end_time": "2026-06-10T23:59:59+08:00"
  }
}
```

注意：执行前需确保已配置：

```bash
sudo docker exec -it postgres psql -U root -d "new-api" -c "INSERT INTO options (key, value) VALUES ('feishu.stats_base_token', 'TYyybwhZKa5wzMsHGKdcGnm9nvg') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"
cd /opt/production-deploy && sudo docker compose restart new-api
```

---

## 7. 回退流程（失败快速恢复）

### 7.1 恢复旧版本

```bash
cd /opt/production-deploy

# 查看备份的旧镜像地址
cat image-old.txt

# 编辑 .env 改回旧镜像
sudo nano .env

# 拉取旧镜像并重启
sudo docker compose pull new-api
sudo docker compose up -d new-api --no-deps

# 验证
sudo docker compose ps
curl -f http://127.0.0.1:3000/api/status
```

### 7.2 数据库回退（仅在 DB 被破坏时使用）

```bash
cd /opt/production-deploy

# 停止应用
sudo docker compose stop new-api

# 恢复数据库
cat backup_<timestamp>.sql | sudo docker exec -i postgres psql -U root -d postgres

# 重启应用
sudo docker compose start new-api
```

---

## 8. 数据安全红线

以下操作会影响数据，**禁止**在发版流程中执行：

- `sudo docker compose down -v`
- 删除数据目录：`pg-data`、`redis-data`、`new-api-data`
- 变更数据库/Redis volume 挂载路径

发版只做：

- 改 `.env` 中的 `NEW_API_IMAGE` tag
- `sudo docker compose pull new-api`
- `sudo docker compose up -d new-api --no-deps`

---

## 9. 常见问题

### 9.1 buildx 构建报 `docker.io ... timeout`

原因：本地网络到 Docker Hub 超时。
处理：`deploy/Dockerfile.local` 使用 `docker.m.daocloud.io` 国内镜像前缀。

### 9.2 `docker login` 密码问题

本地 Mac：
```bash
printf '%s' '<ACR密码>' | docker login --username=beacherlin --password-stdin crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com
```

生产服务器：
```bash
printf '%s' '<ACR密码>' | sudo docker login --username=beacherlin --password-stdin crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com
```

### 9.3 生产拉取镜像报 `not found`

确认 ACR 仓库中存在对应 tag。在本地先 `docker push` 推送成功后，生产才能 `sudo docker compose pull`。

### 9.4 生产 `sudo docker compose` 提示 command not found

安装 Docker Compose 插件：
```bash
sudo apt-get install docker-compose-plugin
# 或 CentOS
sudo yum install docker-compose-plugin
```

验证：
```bash
sudo docker compose version
```

---

## 10. 版本管理

- 使用语义化版本：`1.0.0` → `1.1.0`（功能版本） → `1.1.1`（修复版本）
- 每次发版前做 `.env` 备份和数据库备份
- 保留至少最近 2~3 个稳定 tag 便于回退
- 当前最新版本：`1.1.0`（飞书 OAuth + 订阅系统）
