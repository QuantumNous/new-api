# 多副本运行约束审计

本文档记录 new-api 作为 Kubernetes 多副本运行时的前置约束，所有结论均标注代码依据，供 `deploy/k8s/` 下的部署清单与后续部署文档引用。

对应 issue #69。清单骨架见 `deploy/k8s/README.md`（由 issue #73 交付）。

## 1. 必须跨 Pod 共享的资源

| 资源 | 要求 | 依据 |
|---|---|---|
| 主数据库 | 所有 Pod 连接同一个 PostgreSQL 或 MySQL 实例 | `model/main.go` `chooseDB`（第 127-169 行）按 `SQL_DSN` 前缀选择驱动 |
| Redis（启用时） | 所有 Pod 连接同一个 Redis 端点 | `common/init.go` 中 Redis 初始化与 `common/redis.go` |
| `SESSION_SECRET` | 所有 Pod 必须相同 | 用于派生 Access Token / Refresh Token 摘要，见 `docs/authentication.md` 第 13 行 |
| `CRYPTO_SECRET` | 共享同一 Redis 的 Pod 必须相同 | 缓存键 HMAC 摘要不一致会导致缓存无法复用，见 `docs/authentication.md` 第 27 行 |

数据库是唯一权威数据源。各副本的内存缓存通过定时回源收敛，而不是副本之间互相同步：

- `model.SyncChannelCache`（`model/channel_cache.go:106`）每 `SYNC_FREQUENCY` 秒重新加载渠道缓存
- `model.SyncOptions`（`model/option.go:201`）每 `SYNC_FREQUENCY` 秒重新加载系统选项
- 两者均由 `main.go:101` 与 `main.go:109` 以 goroutine 启动，与 `NODE_TYPE` 无关

因此“数据库/Redis 同步”不需要额外配置，只要所有 Pod 指向同一实例即可。

## 2. NODE_TYPE 对后台任务的影响

节点角色在启动时由环境变量决定：

```go
IsMasterNode = os.Getenv("NODE_TYPE") != "slave"
```

（依据：`common/init.go:89`；变量定义见 `common/constants.go:137`）

未设置 `NODE_TYPE` 时 `IsMasterNode` 为 `true`，即默认按 master 运行；只有显式设置 `NODE_TYPE=slave` 才是 slave。

### 仅 master 执行的后台任务

| 任务 | 依据 |
|---|---|
| 系统任务 Runner（异步任务轮询、渠道模型同步等） | `service/system_task.go:123-127` 的 `if !common.IsMasterNode { return }` |
| 认证 artifact 清理 | `service/auth_cleanup.go:16` |
| Codex 凭证自动刷新 | `service/codex_credential_refresh_task.go:37` |
| 订阅配额重置 | `service/subscription_reset_task.go:31` |
| 数据库迁移与 Option 迁移 | `model/main.go:197`、`model/main.go:241`、`main.go:320` |
| 权限种子数据写入 | `service/authz/enforcer.go:34`、`service/authz/enforcer.go:57` |

系统任务 Runner 注册的定时任务见 `controller/system_task_handlers.go:20-25`：渠道测试、上游模型更新、Midjourney 轮询、异步任务轮询。其中异步任务轮询的启用条件为 `constant.UpdateTask && model.HasUnfinishedSyncTasks()`（`controller/system_task_handlers.go:142-144`）。

### master 与 slave 都会执行的后台循环

以下 goroutine 在 `main.go` 中无条件启动，slave 同样运行：

| 循环 | 依据 |
|---|---|
| 渠道缓存同步 | `main.go:101` → `model/channel_cache.go:106` |
| 系统选项同步 | `main.go:109` → `model/option.go:201` |
| 权限策略同步 | `main.go:112` → `service/authz/enforcer.go:84` |
| 配额数据聚合 | `main.go:115` → `model/usedata.go:41` |
| 实例状态上报 | `main.go:133` → `service/system_instance.go:65`，每 30 秒 upsert 一次 |

结论：`NODE_TYPE=slave` 只关闭上表“仅 master”的任务，不影响该副本接收和处理 `/v1/*` relay 请求。因此把 worker 设为 slave 既能避免后台任务重复，又不损失请求处理能力。

## 3. SQLite 不可用于多副本

`chooseDB` 在两种情况下回退到 SQLite：

- `SQL_DSN` 未设置（`model/main.go:165-168`）
- `SQL_DSN` 以 `local` 开头（`model/main.go:147-151`）

回退时使用 `common.SQLitePath` 打开本地文件（默认 `one-api.db?_busy_timeout=30000`，见 `common/database.go:44`，可由 `SQLITE_PATH` 覆盖，见 `common/init.go:69-71`）。

该文件位于容器自身的文件系统内，多个 Pod 各自持有独立副本，无法构成同一份权威数据。此外 SQLite 缺少 `SELECT ... FOR UPDATE`，`model/locking.go:17-21` 对 SQLite 显式跳过行锁，依赖其单写模型串行化——该假设在多进程多副本下不成立。

结论：多副本部署必须提供 PostgreSQL 或 MySQL 的 `SQL_DSN`。

## 4. /api/status 作为健康探针

路由注册于 `router/api-router.go:24`：

```go
apiRouter.GET("/status", controller.GetStatus)
```

该路由在 `apiRouter` 分组内且未挂任何鉴权中间件（对比同文件第 27 行的 `/status/test` 带 `middleware.AdminAuth()`），因此 kubelet 可以直接探测。

仓库自带的容器健康检查也使用同一端点，可作为可用性佐证：`deploy/docker-compose.yml:63` 通过 `wget -q -O - http://localhost:3000/api/status` 判活。

清单中的用法（`deploy/k8s/new-api-master.yaml`、`deploy/k8s/new-api-worker.yaml`）：

- `livenessProbe`：`initialDelaySeconds: 30`、`periodSeconds: 10`
- `readinessProbe`：`initialDelaySeconds: 10`、`periodSeconds: 5`

注意：`GetStatus` 返回站点配置信息，属于轻量读取，不代表数据库连通性。若需要更强的就绪语义，应另外引入依赖检查端点；本次不改应用代码。

## 5. 环境变量矩阵

| 变量 | 含义 | 必须跨 Pod 一致 | 默认值 | 依据 |
|---|---|---|---|---|
| `SQL_DSN` | 主数据库连接串；多副本必须为 PostgreSQL/MySQL | 是 | 未设置时回退 SQLite | `model/main.go:127-169` |
| `LOG_SQL_DSN` | 独立日志库连接串（可选） | 是（若使用） | 未设置时与主库一致 | `model/main.go:175`、`model/main.go:219` |
| `SQLITE_PATH` | SQLite 文件路径；多副本场景不应使用 | 不适用 | `one-api.db?_busy_timeout=30000` | `common/init.go:69-71`、`common/database.go:44` |
| `REDIS_CONN_STRING` | Redis 端点；只支持单个端点，不解析 Cluster/Sentinel 列表 | 是 | 未设置则不启用 Redis | `common/redis.go` |
| `SESSION_SECRET` | 会话与 Token 摘要密钥 | 是 | 无 | `docs/authentication.md:13` |
| `CRYPTO_SECRET` | 缓存键 HMAC 密钥 | 共享 Redis 时必须 | 回退为 `SESSION_SECRET` | `README.md:323` |
| `NODE_TYPE` | 节点角色；`slave` 关闭 master-only 后台任务 | 否，按角色区分 | 未设置等价 master | `common/init.go:89` |
| `NODE_NAME` | 节点名，用于实例上报与审计日志 | 否，每 Pod 必须唯一 | 回退主机名 | `common/node_identity.go:12-24` |
| `SYNC_FREQUENCY` | 缓存回源周期（秒），也是独立 Redis 下会话缓存最大陈旧窗口 | 建议一致 | `60` | `common/init.go:109` |
| `MEMORY_CACHE_ENABLED` | 启用内存缓存；启用 Redis 时自动置为 true | 建议一致 | `false` | `common/init.go:88`、`main.go:78-81` |
| `BATCH_UPDATE_ENABLED` | 批量写入聚合 | 建议一致 | `false` | `main.go:154-158` |
| `BATCH_UPDATE_INTERVAL` | 批量写入间隔（秒） | 建议一致 | `5` | `common/init.go:110` |
| `FRONTEND_BASE_URL` | slave 上把未匹配前端路由重定向到该地址；master 上被忽略 | 是（若使用） | 无 | `router/main.go:20-26` |
| `TZ` | 时区 | 建议一致 | 无 | 容器环境变量 |

`NODE_NAME` 在清单中通过 `fieldRef: metadata.name` 注入 Pod 名称，天然满足唯一性要求。

## 6. 不跨 Pod 共享的本地状态

`common/disk_cache.go` 把大文件（图片/音频/视频的 base64 数据）写入本地目录 `new-api-body-cache`（依据：`common/disk_cache.go:21` 的 `diskCacheDir` 常量，目录解析见同文件 `GetDiskCacheDir`）。写入判断见 `common/disk_cache.go` 的 `ShouldUseDiskCache`，调用方为 `service/file_service.go:239-246`。

每个 Pod 拥有独立文件系统，因此：

- 同一个远端文件可能被多个 Pod 各自下载并缓存
- 缓存命中率随副本数增加而下降
- 磁盘占用总量上升

请求体临时文件（`common/body_storage.go:129`、`common/body_storage.go:161` 创建，`body_storage.go:218-219` 在关闭时删除）生命周期限于单个请求，多副本不受影响。

缓存策略选择留给 issue #75，本文档只记录约束事实。

## 7. 对部署清单的直接约束

1. `SQL_DSN` 必须指向 PostgreSQL/MySQL，不能留空。
2. `SESSION_SECRET` 与 `CRYPTO_SECRET` 在 master 与所有 worker 上取值必须完全一致。
3. worker 必须设置 `NODE_TYPE=slave`，master 不设置该变量，且 master 副本数保持 1。
4. `NODE_NAME` 每 Pod 唯一。
5. 探针使用 `/api/status`，无需鉴权。
6. 多副本下不要依赖磁盘缓存命中率。
