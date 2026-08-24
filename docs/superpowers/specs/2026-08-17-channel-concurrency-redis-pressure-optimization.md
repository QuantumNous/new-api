# 渠道并发限制 Redis 抗压优化（sub2api 式）

日期：2026-08-17
分支：`feat/channel-concurrency-redis-optimization`（基于 main `d1340c07e`）
背景：渠道级"最大并发数"功能（PR #154/#351）已上线，但按当前 main 的实现，
渠道选择路径对候选集内每个限并发渠道逐一读负载、无缓存无合并；生产 Redis 为
Memorystore Basic 1GiB 单节点，在几十个渠道大规模开启限并发前必须先把
Redis 放大系数压下来。本方案参照 sub2api（`backend/internal/service/concurrency_service.go`
+ `repository/concurrency_cache.go`）的成熟做法移植五项保护。

## 改动总览

| # | 优化 | 对应 sub2api 机制 | Redis 收益 |
|---|------|-------------------|-----------|
| 1 | 负载快照 200ms 短 TTL 缓存 | `accountLoadCache` | 同一候选集 QPS 内重复读全部命中内存，读放大从 O(QPS) 降到 O(1/200ms) |
| 2 | singleflight 合并并发未命中 | `accountLoadGroup` | 突发 N 个并发请求只发 1 次抓取 |
| 3 | pipeline 按 50 渠道分批 + TIME 只取一次 + 分离 context | `GetAccountsLoadBatch` | 单 pipeline ≤151 命令有上界；请求取消不拖垮共享抓取 |
| 4 | 冷却检查折入 acquire Lua 脚本 | acquire 单脚本模式 | 每次抢槽 2 RT→1 RT（省掉独立 EXISTS） |
| 5 | 等待注册 Lua 原子守卫（检查+INCR+EXPIRE 一次完成） | `incrementWaitScript` | 注册 2-3 RT→1 RT；等待队列彻底不超发 |
| 6 | 等待轮询改抖动指数退避（interval/2~interval，×2 至 8×/1s 封顶） | — | 饱和时各实例 waiter 不再整点齐射 |
| 7 | acquire 不确定结果分离 ZREM 清理（500ms 上限、只一次） | — | 客户端超时但脚本已提交时不留 30 分钟幽灵槽 |
| 8 | 每轮选择抢槽预算（默认 8 次，可配） | — | 全饱和候选集单请求抢槽脚本数有上界，预算尽后仍走等待回退 |

## 不变式（与 #352/#353 评审结论一致）

- **缓存只服务排序提示，绝不缓存槽位所有权**——acquire 脚本永远实时执行，
  超卖不可能由缓存引起；代价只是 200ms 内负载排序略陈旧。
- **max_concurrency <= 0 的渠道保持零 Redis 路径**（不变，#351 行为保留；
  bounded 集为空时新代码直接短路返回）。
- **候选集不设总量上限**——分批只是 Redis 命令分片，125 渠道回归测试确认
  全部参与选择；预算耗尽降级为等待候选，不砍低优先级回退。
- **幽灵槽清理不重试**——Redis 故障期间避免压力放大，槽 TTL 兜底。
- Redis 出错时负载读取降级内存、抢槽 fail-closed（多节点正确性），与 main 一致。

## Redis 命令预算（开启缓存后，单实例）

- 负载读取：每 200ms 每个候选集指纹最多 1 次抓取 = `1 TIME + ceil(N/50)
  个 pipeline（每渠道 4 命令）`。50 渠道候选集 ≈ 每秒 5×201 ≈ 1005 cmd/s/实例，
  与 QPS 无关。
- 抢槽：每请求 ≤ MaxAcquireAttempts(8) 个 EVALSHA；命中第一个空闲渠道即停，
  常态 1 个。
- 等待：注册 1 EVALSHA + 每次退避重试 1 EVALSHA（100ms 起×2 到 1s 封顶，
  5s 超时窗口内最多约 7 次）+ 释放 1-2 命令。

## 新配置（channel_concurrency_setting，运营设置热更新）

| 字段 | 默认 | 说明 |
|------|------|------|
| `load_cache_enabled` | true | 关掉即恢复每请求直读 Redis（回滚开关） |
| `load_cache_ttl_ms` | 200 | 快照 TTL，上限 5000 |
| `max_acquire_attempts` | 8 | 每轮选择抢槽脚本预算，上限 100 |

## 兼容性

- 不改 DB schema、不改渠道字段、不改 429 语义与重试链路。
- acquire 脚本从 1 key 变 2 key（并发 key + 冷却 key）：单实例 Memorystore
  无影响；如未来迁 Redis Cluster 需 hash tag 处理（脚本内已注释）。
- `channel_concurrency_wait` 计数键从裸 INCR 改为脚本内 INCR+EXPIRE，键名与
  TTL 语义不变，可与旧版本实例混跑（旧实例超发检查在 INCR 后，新实例在前，
  混跑期间边界最多放行旧逻辑允许的数量）。

## 验证

- `go test ./service -run 'Concurrency|CacheGetRandomSatisfiedChannel'` 全绿
  （含存量 154/351 回归 + 新增 8 个压力语义测试）。
- 新增测试锚点：缓存命中零 Redis 命令、16 并发未命中合并为 1 次 TIME、
  125 渠道分批不丢渠道、冷却拒绝单 RT、20 并发 waiter 不超发（恰好 3 个注册）、
  预算耗尽走等待回退成功、抖动区间 [interval/2, interval)。
- `go vet ./service ./setting/operation_setting` 干净。

## 上线建议

1. 先 staging：开 3-5 个渠道限并发，观察 `new-api Redis CPU high` 告警、
   选择延迟、429 比例、`new-api:channel_concurrency*` 键无残留。
2. 生产灰度：从视频/图片类低 QPS 渠道开始，逐步扩到目标渠道集。
3. 回滚路径：`load_cache_enabled=false` 恢复直读；整体行为退化为 main 现状，
   无需回滚部署。
