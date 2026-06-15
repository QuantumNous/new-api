# 渠道流控与排队功能后续阶段交接计划

日期：2026-06-15

状态：Phase 1 已实现后的后续任务交接文档

当前分支：

```text
codex/flow-pool-scheduling-controls
```

当前已推送基线：

```text
57437580 feat: add flow pool scheduling controls
```

远程分支：

```text
https://github.com/supreme0597/new-api/tree/codex/flow-pool-scheduling-controls
```

相关设计文档：

- `docs/channel-flow-control-queue-design-v3.md`
- `docs/channel-flow-control-queue-design-v2.md`
- `docs/channel-flow-control-queue-design.md`

## 1. 背景与目标

本功能解决的是“上游资源池容量保护”，不是普通用户 RPM/TPM 限速。

典型场景：

```text
一个上游模型资源池背后有 96 张卡。
上游最多只能稳定支持 60 个并发请求。
第 61 个请求不应该继续打到上游。
网关需要根据配置进行排队、拒绝或 fallback。
管理员需要看到实时在途、排队、拒绝、超时、成功等指标，并能追溯趋势。
```

核心目标：

- 限制同一个上游资源池的总在途请求数。
- 超过容量时进入有界队列。
- 队列长度必须有上限。
- 支持单用户最大排队数，避免单个用户占满队列。
- 支持 Redis 后端，保证多实例部署下全局限流一致。
- 支持流控池生效时间，方便按日期范围或周计划启停。
- 支持实时状态和历史趋势图，便于排查流量问题。

## 2. 当前已完成内容

当前分支已经包含第一版可用实现。

### 2.1 后端

已实现文件：

- `model/channel_flow.go`
  - Flow Pool 数据模型。
  - 渠道绑定模型。
  - 分钟级指标模型。
  - 事件模型。
  - 生效时间字段、校验和判断逻辑。
- `controller/channel_flow.go`
  - Flow Pool 管理接口。
  - 渠道绑定管理接口。
  - 状态接口。
  - 趋势接口。
- `service/channel_flow.go`
  - Flow Controller 抽象。
  - Memory backend。
  - FlowGuard 生命周期。
  - Redis 不可用策略。
  - Lease 续租 hook。
  - 指标记录。
- `service/channel_flow_redis.go`
  - Redis backend 初版实现。
  - acquire、enqueue、release、status、renew lease。
- `service/channel_flow_status_sampler.go`
  - 定时采样流控池实时状态，用于趋势图。
- `pkg/channel_flow_metrics`
  - 指标聚合、分钟桶写入和查询。
- `controller/relay.go`
  - 渠道选择后获取 FlowGuard。
  - 排队前只做 billing precheck。
  - acquire 成功后再做 billing reserve/preconsume。
  - 单次请求结束后记录 outcome 并 release guard。

### 2.2 前端

已实现目录：

- `web/default/src/features/channel-flow`
  - Flow Pool 列表页。
  - 创建/编辑 Flow Pool 表单。
  - 渠道绑定面板。
  - 实时状态面板。
  - 趋势图面板。

当前支持的生效时间：

- 始终生效。
- 日期范围。
- 每周重复，支持跨午夜窗口。

当前左侧卡片展示：

- 当前生效 / 当前未生效。
- 生效时间摘要。
- 后端类型。
- 满载策略。
- 紧凑容量标签，例如 `容量 60+240`。

当前状态刷新选项：

- 关闭。
- 1 秒。
- 2 秒。
- 5 秒。
- 10 秒。
- 30 秒。

不提供 500 ms 轮询。后续如果需要更实时状态，建议用 SSE 或 WebSocket。

### 2.3 已验证内容

提交前已执行：

```text
bun run build
bun run i18n:sync
GOCACHE=/private/tmp/new-api-go-build go test ./model ./service ./pkg/channel_flow_metrics -count=1
git diff --check
```

已手工验证：

- 使用本地管理员账号登录。
- Flow Pool 页面可打开。
- 始终生效池显示当前生效。
- 未来日期范围显示当前未生效。
- 周一到周五 09:00-18:00 在当前窗口内显示当前生效。
- 左侧卡片时间摘要与右侧状态一致。
- 保存后立刻编辑，生效时间字段能正确回填。
- 临时测试流控池已删除。

## 3. 必须保留的产品决策

后续同事继续开发时，除非产品明确变更，否则请保持以下决策。

### 3.1 `pool_id` 不是用户输入

用户和管理员不应该手动输入 runtime `pool_id`。

正确方式：

```text
管理员创建 Flow Pool
  -> 后端生成 pool_key
  -> 管理员把渠道绑定到 Flow Pool
  -> 运行时按 channel_id 解析绑定关系
```

### 3.2 绑定必须显式配置

不要用上游 URL 自动合并流控池。

原因：

- 同一个 URL 可能服务多个物理资源池。
- 同一个 URL + 不同 key 可能对应不同租户。
- 同一个物理池也可能有多个 URL。
- 模型映射后真实上游模型可能变化。

URL 可以作为 UI 上的辅助提示，但不能作为运行时绑定依据。

### 3.3 同一个渠道同一时间只能属于一个启用的 Flow Pool

当前 controller 已阻止正常 UI 创建重复启用绑定。

后续还需要做：

- 脏数据检测。
- UI 冲突提示。
- 是否增加跨数据库兼容的唯一约束或启动健康检查。

### 3.4 队列长度必须有上限

不能做无限排队。

必须保留：

- `max_queue_size`
- `queue_timeout_ms`
- `max_queue_per_user`

### 3.5 生效时间外是绕过，而不是随机尝试另一个池

当前语义：

```text
渠道绑定了 Flow Pool
  -> Flow Pool 未启用或当前不在生效时间
  -> 该请求绕过这个 Flow Pool
```

不要在运行时随机匹配另一个 Flow Pool。否则排查会非常困难。

### 3.6 多实例生产必须使用 Redis

Memory backend 只适合：

- 本地开发。
- 单实例部署。
- Redis 故障时的临时 local_memory fallback。

生产多实例要保证全局并发上限，必须使用 Redis backend。

## 4. 当前已知风险与缺口

### 4.1 流式请求生命周期还需要专项审计

当前代码已经有：

- `FlowGuard.RenewLease`
- `startChannelFlowLeaseRenewer`
- `FlowGuard.WrapReadCloser`

但下一阶段仍必须专项审计：

- relay helper 是否真的阻塞到下游 stream 完成。
- WebSocket realtime 是否持有 guard 到连接结束。
- 客户端断开时是否及时 release。
- 上游 stream 报错时是否 release。
- retry 前一次 attempt 是否一定 release。
- `WrapReadCloser` 是否需要接入某些 provider path。

这是下一阶段 P0。

### 4.2 Redis backend 需要生产化验证

Redis backend 已有初版，但还不能直接视为生产稳定。

需要验证：

- 高并发 acquire/enqueue/release 原子性。
- FIFO 公平性。
- 队列超时清理。
- 单用户队列上限。
- lease 过期清理。
- Redis 故障策略。
- 多实例共享 Redis 时，总在途是否严格受控。

Lua 不是一开始必须做。

建议：

```text
先测当前 Redis 实现的冲突率和正确性。
如果 WATCH/MULTI 冲突高，或组合操作难以证明正确，再把核心 hot path 改成 Lua。
```

### 4.3 绑定冲突治理不足

当前 controller 能阻止正常新增重复绑定，但还缺：

- 已存在脏数据检测。
- 管理页冲突告警。
- 修复入口。
- 跨 SQLite/MySQL/PostgreSQL 的 DB 约束方案评估。

### 4.4 可观测性还不够完整

当前已有状态和趋势图，但线上排查还需要：

- 事件明细。
- 配置变更审计。
- 绑定变更审计。
- Redis 降级和 fallback 事件。
- lease renew 失败明细。
- 排队超时、拒绝原因拆解。

### 4.5 缺少压测和多实例 E2E

必须补：

- 单实例压测。
- Redis 多实例压测。
- stream 长连接压测。
- client abort 释放验证。
- queue full / queue timeout / per-user queue full 验证。

## 5. 下一阶段推荐计划

### Phase A：Relay 生命周期与流式请求正确性

优先级：P0

目标：

```text
保证每个 FlowGuard 都只在真实请求生命周期内持有，并且最终只释放一次。
```

任务：

1. 审计 relay helper。
   - `relayHandler`
   - `geminiRelayHandler`
   - `relay.ClaudeHelper`
   - `relay.WssHelper`
   - OpenAI-compatible streaming
   - Responses API streaming
   - Claude streaming
   - Gemini streaming

2. 审计 `controller/relay.go` 的 release 路径。
   - pricing error
   - billing reserve error
   - request body read error
   - upstream helper error
   - retry
   - panic/recover
   - client cancel

3. 明确 stream 生命周期。
   - 如果 helper 会阻塞到 stream 完成，则写测试或注释固化这个约定。
   - 如果 helper 会提前返回，则必须用 `FlowGuard.WrapReadCloser` 或等价方式绑定 stream close。

4. 验证 Redis lease 续租。
   - acquire 后启动。
   - release 后停止。
   - 续租失败记录 metric。
   - 长 stream 超过 `lease_ms` 时，slot 不应被错误释放。

验收标准：

- 没有已知 guard 泄漏路径。
- 没有已知 stream 未结束就 release 的路径。
- `Release` 幂等。
- 长 stream 测试通过。
- client abort 后容量可恢复。

建议测试：

```text
go test ./service -run ChannelFlow
go test ./controller -run Relay
```

如果 controller 测试成本过高，可以先加 fake relay lifecycle test。

### Phase B：Redis backend 正确性与多实例验证

优先级：P0

目标：

```text
证明 Redis backend 能在多实例部署下限制全局容量。
```

任务：

1. 增加 Redis 集成测试。
   - 建议通过环境变量开启，避免默认测试依赖 Redis。

```text
CHANNEL_FLOW_REDIS_TEST=1
REDIS_CONN_STRING=redis://localhost:6379/...
```

2. 高并发 acquire/enqueue 测试。
   - `max_inflight=1`
   - `max_queue_size=2`
   - 只允许 1 个 running。
   - 最多 2 个 waiting。
   - 第 4 个请求应被拒绝。

3. release promotion 测试。
   - release running 后，队首 queued 能进入 running。
   - FIFO 顺序稳定。
   - 已取消或超时的队首不会阻塞后续请求。

4. 单用户队列上限测试。
   - 同一个用户不能超过 `max_queue_per_user`。
   - 不同用户仍可使用全局队列剩余空间。

5. lease expiry 测试。
   - running 过期后能被清理。
   - 如有指标设计，记录 lease expired。

6. Redis 故障策略测试。
   - `fail_open`
   - `fail_closed`
   - `local_memory`

7. 冲突率评估。
   - 如果当前 Redis 实现使用 WATCH/MULTI，需要统计事务冲突和重试次数。
   - 冲突过高时再考虑 Lua。

验收标准：

- 多实例总 running 不超过 `max_inflight`。
- queue 不超过 `max_queue_size`。
- per-user queue cap 生效。
- Redis 故障表现符合配置。

### Phase C：绑定冲突治理

优先级：P1

目标：

```text
让重复绑定和歧义绑定可见、可阻止、可修复。
```

任务：

1. 增加冲突检测服务。
   - 检测同一 `channel_id + match_mode` 下多个 enabled binding。

2. 前端展示冲突提示。
   - Flow Pool 页面展示。
   - 绑定弹窗展示。
   - 后续可以在渠道编辑页展示。

3. 评估 DB 约束。
   - 跨 SQLite/MySQL/PostgreSQL 的部分唯一索引并不简单。
   - 如果不加 DB 约束，需要启动检查和 admin health check。

4. 优化绑定体验。
   - 继续避免用户手输渠道 ID。
   - 显示渠道名、ID、类型、base URL。
   - 支持搜索。

验收标准：

- UI 不能创建重复启用绑定。
- 已存在脏数据能被管理员看到。
- runtime 对脏数据的行为确定且有文档说明。

### Phase D：观测与审计增强

优先级：P1

目标：

```text
管理员能从页面解释一次 429、排队、超时或 Redis 降级。
```

任务：

1. 增加事件明细 API。
   - pool
   - channel
   - model
   - user
   - event type
   - time range
   - request id

2. 增加事件表格。
   - 最近排队。
   - 最近拒绝。
   - 最近超时。
   - 最近 release。
   - wait_ms / process_ms。

3. 增加配置审计。
   - Flow Pool 创建、修改、删除。
   - 绑定创建、删除。
   - 生效时间变化。
   - 容量变化。

4. 完善趋势图。
   - 拒绝原因拆分。
   - timeout/cancelled/billing_failed 展示。
   - 后续可增加 p95 wait time。

验收标准：

管理员能回答：

- 为什么这个请求 429？
- 是不是池满了？
- 是不是不在生效时间？
- Redis 是否降级？
- 这个请求命中了哪个 channel 和 Flow Pool？

### Phase E：渠道编辑页集成

优先级：P2

目标：

```text
管理员可以在渠道创建/编辑流程里直接管理 Flow Pool 绑定。
```

任务：

1. 渠道编辑页增加 Flow Control 区块。
   - 显示当前绑定。
   - 选择已有 Flow Pool。
   - 跳转或弹窗创建 Flow Pool。

2. 增加上下文提示。
   - 可以基于 base URL 提示候选池。
   - 不能自动绑定。
   - 明确说明 URL 不是流控池归属依据。

3. 后续再支持 channel + upstream_model 绑定。
   - 当前 Phase 1 是 channel-level binding。
   - model-level binding 等 Redis 和生命周期稳定后再做。

验收标准：

- 管理员不需要输入渠道 ID。
- 渠道页面能看到当前绑定状态。
- 不会因为相同 URL 自动合并池。

### Phase F：上线准备

优先级：P1，上生产前必须完成

目标：

```text
让运维和管理员能安全启用、观察和回滚。
```

任务：

1. 编写运维文档。
   - 推荐配置。
   - Redis backend 要求。
   - queue timeout 建议。
   - failure policy 建议。

2. 编写部署检查清单。
   - SQLite/MySQL/PostgreSQL migration 验证。
   - Redis 连通性。
   - 初始 pool 先 disabled 或小流量 canary。
   - 指标保留策略。

3. 编写灰度方案。
   - 先绑定非核心渠道。
   - 小队列。
   - 观察 reject、timeout、lease renew failure、Redis health。
   - 再扩大覆盖范围。

4. 编写回滚方案。
   - 禁用 Flow Pool。
   - 删除绑定。
   - 必要时调整 Redis failure policy。

验收标准：

- 管理员不用读代码也能启用功能。
- 回滚不需要直接改数据库。

## 6. 推荐执行顺序

建议后续同事按这个顺序执行：

```text
1. Phase A：relay 生命周期和 stream guard 审计。
2. Phase B：Redis 多实例正确性测试。
3. Phase C：绑定冲突治理。
4. Phase D：事件明细和审计。
5. Phase E：渠道编辑页集成。
6. Phase F：上线文档和灰度方案。
```

不要先继续做 UI 小优化。

当前最大风险不是页面样式，而是：

- guard 提前释放。
- guard 泄漏。
- Redis 并发竞态。
- 多实例超发。
- 长流式请求 lease 过期。

## 7. 测试矩阵

### 7.1 单元测试

已有或应扩展：

```text
model/channel_flow_schedule_test.go
service/channel_flow_test.go
pkg/channel_flow_metrics/metrics_test.go
```

继续补充：

- 周计划跨午夜。
- 日期范围边界。
- disabled pool bypass。
- memory FIFO。
- memory queue timeout。
- memory per-user queue cap。
- guard idempotent release。
- metrics 聚合。

### 7.2 Redis 集成测试

需要覆盖：

- acquire capacity。
- enqueue capacity。
- queue full rejection。
- per-user queue full rejection。
- release promotion。
- queue timeout cleanup。
- lease renewal。
- lease expiry cleanup。
- Redis outage policies。

### 7.3 Relay 生命周期测试

需要覆盖：

- 非流式成功。
- 非流式上游错误。
- 流式成功。
- 流式客户端中断。
- 流式上游中断。
- 第一次渠道失败后 retry。
- acquire 后 billing 失败。

### 7.4 手工 UI 测试

本地管理员账号：

```text
root / codexAdmin123
```

检查项：

- 创建池。
- 编辑池。
- 删除未绑定池。
- 搜索和绑定渠道。
- 重复绑定被阻止。
- 始终生效。
- 未来日期范围未生效。
- 当前日期范围生效。
- 每周生效窗口生效。
- 每周非窗口未生效。
- 刷新频率显示文字，不显示 `1000/2000`。
- 趋势范围切换正常。

### 7.5 压测场景

基础场景：

```text
max_inflight=1
max_queue_size=2
max_queue_per_user=2
queue_timeout_ms=30000
backend=redis
```

预期：

- 第 1 个请求进入上游。
- 第 2、3 个请求排队。
- 第 4 个请求返回 429。
- 第 1 个请求释放后，第 2 个请求进入 running。
- 客户端中断后 slot 可恢复。

多实例场景：

```text
启动两个 new-api 实例
连接同一个 Redis
同时向两个实例发请求
全局 running 不超过 max_inflight
```

## 8. 运行时语义

后续实现应保持这个语义：

```text
请求进入 relay
  -> 选择渠道
  -> 按 channel_id 解析 Flow Pool
  -> 如果无绑定、disabled、或不在生效时间：绕过 flow control
  -> acquire FlowGuard
  -> acquire 后做 billing reserve/preconsume
  -> 调用上游
  -> 记录 outcome
  -> release guard
```

retry 语义：

```text
每次 retry 都会重新选择渠道。
每次 attempt 独立解析 Flow Pool。
每次 attempt 独立 acquire 和 release。
Flow control rejection 默认不应继续 retry，除非后续明确设计。
```

billing 语义：

```text
排队前只做只读 precheck。
排队中不扣费。
acquire 成功后才 reserve/preconsume。
如果等待后扣费失败，要 release slot，并返回清晰错误。
```

schedule 语义：

```text
always: enabled 即生效。
datetime_range: start <= now < end。
weekly: 按配置时区判断本地时间窗口。
weekly 跨午夜: 开始日晚上到次日早上。
窗口外: 绕过该 Flow Pool。
```

## 9. 推荐生产配置

60 并发上游资源池建议初始配置：

```text
max_inflight=60
max_queue_size=240
max_queue_per_user=2 或 3
queue_timeout_ms=120000
queue_policy=fifo
on_limit=queue
backend=redis
redis_failure_policy=fail_closed
```

策略建议：

- 严格保护上游容量：`fail_closed`。
- 开发环境或低风险场景：可用 `local_memory`。
- 谨慎使用 `fail_open`，因为 Redis 故障时可能导致上游被打爆。

## 10. 待确认问题

后续需要产品或技术负责人确认：

1. `fail_open` 是否允许在生产 UI 中直接选择，还是作为高级选项并加警告。
2. 重复绑定是否必须增加 DB 约束，还是通过 service + health check 管控。
3. Flow Pool event 保留多久：7 天、30 天，还是可配置。
4. 每周计划是否只支持一个窗口，还是支持多个窗口。
5. `channel + upstream_model` 绑定是在 Redis 稳定前做，还是稳定后做。
6. 实时状态后续是否改成 SSE/WebSocket。

## 11. 接手检查清单

下一位同事开始前建议先做：

```text
git status --short --branch
git log -1 --oneline
```

阅读：

- `docs/channel-flow-control-queue-design-v3.md`
- `docs/channel-flow-next-phase-plan.md`

跑基线测试：

```text
GOCACHE=/private/tmp/new-api-go-build go test ./model ./service ./pkg/channel_flow_metrics -count=1
cd web/default && bun run build
cd web/default && bun run i18n:sync
```

第一个实际任务建议从这里开始：

```text
审计 controller/relay.go 和所有 streaming relay helper。
证明 FlowGuard 是否持有到真实 stream 结束。
如果不能证明，就补 lifecycle wrapper 或测试。
```
