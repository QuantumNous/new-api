# 部署指南

> 本指南覆盖 AIKanHub 的本地 Docker 部署。生产环境（k8s / 多区域 / CDN）暂未在本指南覆盖范围内。

## 一、前置要求

| 工具/服务 | 用途 | 备注 |
|---|---|---|
| Docker 24+ + Docker Compose v2 | 跑应用容器 | 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 即可 |
| [Neon](https://console.neon.tech) 账号 | PostgreSQL 数据库 | Free 层够 MVP |
| 火山引擎 Ark API key | Seedance 2.0 上游 | 在 [火山引擎控制台](https://console.volcengine.com/ark) 申请，形如 `ark-xxxxxxxx` |

可选：自有域名 + TLS（如要对外提供服务）。

## 二、5 步部署

### 步骤 1：克隆仓库

```bash
git clone git@github.com:NekoAIKan/aikanhub.git
cd aikanhub
```

### 步骤 2：创建 Neon 数据库

1. 登录 [console.neon.tech](https://console.neon.tech)，新建 project
   - Region 推荐 **AWS Singapore** 或 **AWS Tokyo**（国内访问最快）
2. 进入 project → 右上角 **Connection Details**
3. ⚠️ 选 **"Direct connection"**，**不要选** "Pooled connection"
   （PgBouncer 的 transaction mode 会和 GORM prepared statements 冲突）
4. 复制连接串，形如：
   ```
   postgresql://neondb_owner:npg_xxx@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

### 步骤 3：配置环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，填入 Neon 连接串：

```bash
SQL_DSN=postgresql://neondb_owner:npg_xxx@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

其他字段（Redis 密码、SESSION_SECRET 等）已生成默认值，**生产部署前务必改 SESSION_SECRET**：

```bash
# 生成新的 SESSION_SECRET
openssl rand -hex 32
```

### 步骤 4：启动

```bash
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
```

首次启动：
- 镜像 build 约 5–10 分钟（后续 build 缓存命中后 20 秒内）
- 容器启动后会跑一次 schema migration（Neon 远程往返 60–90 秒）
- 之后重启走 schema-hash 跳过迁移，**约 11 秒就绪**

等待就绪：

```bash
until curl -sf http://localhost:3000/api/status > /dev/null; do sleep 2; done && echo "READY"
```

### 步骤 5：首次配置

打开浏览器访问 [http://localhost:3000](http://localhost:3000)：

1. **注册首个用户**——自动成为 root admin（角色 100）
2. **进入「渠道管理」→「添加新的渠道」**：
   - 类型：搜索"豆包视频"（type 54 / DoubaoVideo）
   - 名称：`doubao-prod`
   - 分组：勾选 `default`
   - 模型：手动添加 `doubao-seedance-2-0-260128` 和 `doubao-seedance-2-0-fast-260128`
   - 密钥：粘贴你的火山引擎 ark token
   - 代理 / Base URL：留空（adaptor 自带 `https://ark.cn-beijing.volces.com`）
   - 保存 → 点"测试"按钮验证连通
3. **「令牌」→「添加新的令牌」**，复制 `sk-` 开头的字符串
4. **测试 API**：

```bash
export AIKANHUB_TOKEN=sk-xxxxxxxx
bash tools/test-seedance.sh
```

预期：90–120 秒后输出 `SUCCESS` 和视频 URL。

---

## 三、日常运维

### 升级到新版本

```bash
git pull
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
```

- Schema 没变 → 11 秒就绪（hash 检查跳过迁移）
- Schema 有变 → 自动迁移 + 写入新 hash，下次重启又快了

### 查看日志

```bash
docker compose -f docker-compose.local.yml --env-file .env.local logs -f app
```

错误日志单独看：

```bash
docker compose -f docker-compose.local.yml --env-file .env.local logs app | grep -E "ERROR|FATAL"
```

### 停服 / 重启

```bash
# 停服（保留 Redis 数据）
docker compose -f docker-compose.local.yml --env-file .env.local down

# 完全重置（删除 Redis volume；不影响 Neon 数据）
docker compose -f docker-compose.local.yml --env-file .env.local down -v

# 只重启 app（保留 redis 容器，最快）
docker compose -f docker-compose.local.yml --env-file .env.local restart app
```

### 备份

- **Neon**：自带 Point-in-Time Restore（Launch tier $19/月起），不需要手动备份
- **Redis**：本地缓存，不需要备份
- **应用配置**：在 admin 后台「系统设置」改的内容存在 Neon `options` 表里，已被 Neon 自动备份覆盖
- **`.env.local`**：本地文件，请自行妥善保管（含 Neon 密码、ark key 等敏感信息）

---

## 四、常见问题

### Q1：启动时 SLOW SQL 刷屏

**正常**——首次启动 GORM AutoMigrate 在 Neon 远程跑 ~100 个 schema 检查查询，每个 200–400ms。

> 如果重启依然刷屏，说明 schema-hash 没存进去：检查 `Option` 表里 `SchemaMigrationHash` 是否有值。可以临时用 `SKIP_AUTO_MIGRATION_HASH_CHECK=true` 强制再跑一次。

### Q2：`/v1/video/generations` 返回 `model_price_error`

模型定价没配。两种处理：

```javascript
// 方式 A：开启自用模式（绕过定价检查，仅适合内部测试）
fetch('/api/option/', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'New-Api-User': '1',
    'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
  },
  body: JSON.stringify({key: 'SelfUseModeEnabled', value: 'true'}),
}).then(r => r.json()).then(console.log)
```

```javascript
// 方式 B：配定价（生产推荐）
const priceMap = {
  'doubao-seedance-2-0-260128': 0.885,
  'doubao-seedance-2-0-fast-260128': 0.712,
};
fetch('/api/option/', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'New-Api-User': '1',
    'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
  },
  body: JSON.stringify({key: 'ModelPrice', value: JSON.stringify(priceMap)}),
}).then(r => r.json()).then(console.log)
```

### Q3：视频预览返回 502

视频上游 URL 24 小时过期。生成成功后第一时间通过 `/v1/videos/{task_id}/content` 下载到本地或自有对象存储。永久存储计划见 [Issue #7](https://github.com/NekoAIKan/aikanhub/issues/7)。

### Q4：用户注册后没有额度

新用户默认额度由 admin 在系统设置里配置。手动给某个用户充额度（admin 在浏览器控制台跑）：

```javascript
fetch('/api/user/manage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'New-Api-User': '1',
    'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
  },
  body: JSON.stringify({id: <user_id>, action: 'add_quota', mode: 'add', value: 50000000}),  // 50000000 quota = $100
}).then(r => r.json()).then(console.log)
```

### Q5：build 太慢

第一次 build ~20s，已用 BuildKit cache mounts。如果异常慢：

```bash
docker builder prune --all  # 清空 build cache 重来
docker compose -f docker-compose.local.yml --env-file .env.local build --no-cache
```

### Q6：站点名/logo 显示成 `New API`/旧图标

DB 里 `SystemName` Option 还是初始值。两种处理：

- 进 admin 后台 → 系统设置 → 站点信息，改成 `AIKanHub`
- 或浏览器控制台跑：

```javascript
fetch('/api/option/', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'New-Api-User': '1',
    'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
  },
  body: JSON.stringify({key: 'SystemName', value: 'AIKanHub'}),
}).then(r => r.json()).then(console.log)
```

Logo 是编译进二进制的，必须 `up -d --build` 重新构建才会生效（仅在替换了 `web/default/public/logo.png` 之后才需要）。

---

## 五、生产化清单（上线前过一遍）

- [ ] `.env.local` 里的 `SESSION_SECRET` 重新生成（默认值是开发用）
- [ ] `.env.local` 里的 `REDIS_CONN_STRING` 密码改成强密码（同步改 `docker-compose.local.yml` 里 redis-server 的 `--requirepass`）
- [ ] Neon 升 Launch tier（$19/月）关闭 auto-suspend，避免冷启动
- [ ] 配置反向代理（Nginx / Caddy）+ TLS 证书
- [ ] 在 admin 后台关闭"自用模式"，配好真实定价
- [ ] 关闭注册或加上邮箱验证（按业务需要）
- [ ] 配置火山引擎账号的并发上限（默认 10），按预期流量调整
- [ ] 视频任务持久化方案（Issue #7）跟进——避免 24h 后用户拿不到视频
- [ ] 监控：用 Uptime Kuma 或类似工具盯 `/api/status`

---

## 六、相关文档

- API 调用：站内 `/docs` 页面
- 仓库：[NekoAIKan/aikanhub](https://github.com/NekoAIKan/aikanhub)
- 上游归属：[NOTICE.md](./NOTICE.md)
- 协议：[LICENSE](./LICENSE)（AGPL-3.0）
