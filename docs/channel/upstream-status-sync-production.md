# 上游状态同步与生产启用说明

## 已启用的能力

aiapi114 已接入基于 Uptime Kuma 状态页的数据展示能力，并把状态页面数据改为“先同步入库，再由公共接口读取同步数据”的模式。

公共展示接口：

```text
GET /api/uptime/status
```

该接口返回按“供应商 + 分组 + 模型”包装后的状态数据，并包含最近 5 小时的状态变化点。接口读取 Redis 缓存，缓存失效后才访问数据库，避免公共接口在高并发下直接冲击数据库。

## 生产环境需求

### 必需

- aiapi114 主节点必须可访问外网：
  - `https://status.ikuncode.cc/api/status?period=90m&board=hot`
  - `https://status.rjj.cc/api/status-page/foxcode`
  - `https://status.rjj.cc/api/status-page/heartbeat/foxcode`
- 数据库账号需要具备建表和创建索引权限。项目启动时会通过 `AutoMigrate` 创建 `supplier_status_syncs` 表。
- Redis 必须配置：

```env
REDIS_CONN_STRING=redis://:<password>@<host>:6379/0
```

### 推荐

```env
UPSTREAM_STATUS_SYNC_ENABLED=true
UPSTREAM_STATUS_SYNC_INTERVAL_SECONDS=180
REDIS_POOL_SIZE=20
```

说明：

- `UPSTREAM_STATUS_SYNC_ENABLED=false` 时会关闭上游状态同步任务。
- `UPSTREAM_STATUS_SYNC_INTERVAL_SECONDS` 最小有效值为 60 秒，默认 180 秒。
- 同步任务只在 `common.IsMasterNode=true` 的节点运行，避免多副本重复同步。

## 生产启用步骤

1. 部署包含本次变更的版本。
2. 确认数据库迁移完成，存在表：

```sql
SELECT COUNT(*) FROM supplier_status_syncs;
```

3. 确认 Redis 连通，启动日志应包含 Redis enabled / connected 信息。
4. 确认状态页面开关为启用。若生产库此前关闭过 Uptime Kuma 面板，需要在后台配置中打开：

```json
{
  "uptime_kuma_enabled": true
}
```

5. 等待一个同步周期，访问：

```text
https://<你的域名>/api/uptime/status
```

6. 检查返回中是否包含 `Ikun` 和 `Foxcode` 分组，以及每个模型 / 线路的 `history`。

## 同步入库表

表名：

```text
supplier_status_syncs
```

核心字段：

| 字段 | 说明 |
| --- | --- |
| `provider` | 供应商标识，例如 `ikun`、`foxcode` |
| `display_name` | 展示名，例如 `Ikun`、`Foxcode` |
| `group_name` | 展示分组，例如 `Codex Pro`、`Codex 分组` |
| `monitor_id` | 供应商内稳定监控键 |
| `monitor_name` | 监控项展示名 |
| `model_name` | 平台展示的模型名；Foxcode 暂用线路名 |
| `status` | 状态码，`1` 表示正常，`0` 表示异常，Ikun 的 `2` 表示降级 |
| `availability` | 可用性参数，Ikun 使用接口点位可用率，Foxcode 使用 24 小时 uptime 百分比 |
| `latency` | 延迟，单位毫秒 |
| `checked_at` | 状态点时间戳 |
| `raw` | 原始点位 JSON，便于审计和后续策略优化 |

唯一键：

```text
provider + monitor_id + checked_at
```

该唯一键保证定时任务重复拉取同一时间点时执行 upsert，不产生重复数据。

## 当前两家供应商的适配规则

### Ikun

来源：

```text
https://status.ikuncode.cc/api/status?period=90m&board=hot
```

映射：

- `groups[].provider` -> `group_name`
- `groups[].provider_slug + ":" + layers[].request_model` -> `monitor_id`
- `layers[].request_model` -> `model_name`
- `layers[].timeline[]` -> 同步点位

### Foxcode

来源：

```text
https://status.rjj.cc/api/status-page/heartbeat/foxcode
```

补充元数据来源：

```text
https://status.rjj.cc/api/status-page/foxcode
```

映射：

- `publicGroupList[].name` -> `group_name`
- `monitorList[].id` -> `monitor_id`
- `monitorList[].name` -> `monitor_name` 和 `model_name`
- `heartbeatList[id][]` -> 同步点位
- `uptimeList[id + "_24"]` -> `availability`

Foxcode 当前没有模型级 `request_model` 字段，所以先按“监控线路 ID / 线路名”展示，动态调度阶段需要单独维护“线路 -> 渠道 / 模型”的映射。

## 动态调度方案预案

动态调度本轮不启用，仅预留方案：

1. 增加“状态监控映射配置”，把 `provider + monitor_id/model_name` 映射到本地 `channel_id + ability.model`。
2. 增加“动态调度覆盖层”，保存基准 `priority`、`weight` 和动态调整后的值，避免覆盖管理员手动配置。
3. 策略引擎按最近 5 小时状态计算健康等级：
   - `healthy`：恢复基准优先级和权重。
   - `degraded`：降低权重或降低一档优先级。
   - `unhealthy`：禁用对应模型能力。
   - `unknown`：不产生新动作。
4. 安全规则：
   - 手动禁用的渠道不自动启用。
   - 单模型异常只影响对应 `ability`，不直接禁用整个渠道。
   - 某模型只剩最后一个可用渠道时，只降权和告警，不直接禁用。
   - 所有动作写审计日志，支持回滚到基准配置。

## 验证命令

```powershell
go test ./service ./controller ./setting/console_setting -count=1
```
