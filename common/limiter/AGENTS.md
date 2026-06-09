<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# common/limiter

## Purpose

基于 Redis + Lua 脚本的**令牌桶（Token Bucket）分布式限流器**。通过嵌入的 Lua 脚本在 Redis 服务器端原子执行令牌计算，避免竞态条件。使用 `sync.Once` 单例初始化，整个进程共享同一个 `RedisLimiter` 实例。目前被 `middleware/model-rate-limit.go` 用于模型级别的并发/速率控制。

## Key Files

| File | Description |
|------|-------------|
| `limiter.go` | 包主文件。定义 `RedisLimiter` 结构体、`Config` / `Option` 选项模式、`New()`（单例构造，`sync.Once`）、`Allow()`（执行限流判断）以及 `WithCapacity` / `WithRate` / `WithRequested` 三个选项函数 |
| `lua/rate_limit.lua` | 令牌桶 Lua 脚本，通过 `//go:embed` 嵌入二进制。接受 `KEYS[1]`（限流 key）、`ARGV[1]`（本次消耗令牌数）、`ARGV[2]`（每秒补充速率）、`ARGV[3]`（桶容量）；使用 Redis `HMGET`/`HMSET` 读写 `tokens`/`last_time` 两个字段；返回 `1`（允许）或 `0`（拒绝）|

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `lua/` | Lua 脚本资源，通过 `//go:embed` 在编译时嵌入，不产生运行时文件依赖 |

## For AI Agents

### Working In This Directory

- **单例约束**：`New()` 使用 `sync.Once`，全进程只有一个 `RedisLimiter` 实例。若需要支持多 Redis 实例或多配置，必须重新设计（当前不支持）。
- **脚本预加载**：`New()` 调用时通过 `ScriptLoad` 将 Lua 脚本上传到 Redis，保存返回的 SHA，后续 `Allow()` 用 `EvalSha` 执行。**Redis 重启后 SHA 失效**，但当前代码未处理 `NOSCRIPT` 错误自动重载，修改时需注意。
- **时间粒度**：Lua 脚本使用 `redis.call('TIME')` 获取 Redis 服务器秒级时间戳（`now[1]`），令牌补充精度为整秒。注意脚本中 `EXPIRE` 行已注释掉，桶 key 不会自动过期，长期不活跃的 key 会残留在 Redis 中。
- **选项默认值**：`Allow()` 默认 `Capacity=10, Rate=1, Requested=1`；调用方通过 `WithCapacity` / `WithRate` / `WithRequested` 覆盖。
- **中间件用法**（`middleware/model-rate-limit.go`）：key 由渠道/模型/用户维度组合，`WithCapacity(totalMaxCount * duration)`、`WithRate(totalMaxCount)`、`WithRequested(duration)`，从而将"每分钟 N 次"映射到令牌桶参数。
- 修改 Lua 脚本后需重新编译（`//go:embed` 在构建时嵌入），并在测试环境验证 `ScriptLoad` 返回新 SHA。

### Testing Requirements

- 当前无独立 `_test.go` 文件。集成测试依赖真实 Redis 实例。
- 建议测试场景：首次请求（桶初始化）、桶满时连续请求、速率恢复后再请求、`Allow()` 返回 `false` 时不消耗令牌。
- 运行命令：`go test ./common/limiter/...`（需要 Redis）

### Common Patterns

```go
// 初始化（在 middleware 或 main 中执行一次）
tb := limiter.New(ctx, rdb)

// 判断是否允许
allowed, err := tb.Allow(ctx, key,
    limiter.WithCapacity(int64(maxCount)*int64(durationSec)),
    limiter.WithRate(int64(maxCount)),
    limiter.WithRequested(int64(durationSec)),
)
if !allowed {
    // 返回 429
}
```

## Dependencies

### Internal
- `github.com/QuantumNous/new-api/common` — 仅用于 `common.SysLog` 输出脚本加载失败日志

### External
- `github.com/go-redis/redis/v8` — Redis 客户端，`EvalSha` / `ScriptLoad`
- `sync` — `sync.Once` 单例保证
- `embed` — `//go:embed` 嵌入 Lua 脚本

<!-- MANUAL: -->
