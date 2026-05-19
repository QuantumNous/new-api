<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# cachex

## Purpose
混合缓存抽象层，提供统一的缓存接口：Redis 可用时使用 Redis，Redis 不可用时自动降级到进程内 hot cache（基于 `samber/hot`）。通过 `Namespace` 类型实现键名命名空间隔离，避免不同业务场景的缓存键冲突。

## Key Files
| File | Description |
|------|-------------|
| `hybrid_cache.go` | 核心实现：`HybridCache[V]` 泛型结构体，统一 Get/Set/Del 接口，内部根据 `RedisEnabled` 动态路由到 Redis 或 in-memory；`HybridCacheConfig` 配置结构体 |
| `namespace.go` | `Namespace` 类型（`type Namespace string`），提供 `FullKey`、`MatchPattern` 方法，为缓存键添加命名空间前缀（格式：`namespace:key`） |
| `codec.go` | `ValueCodec[V]` 接口：定义 Redis 存储时的值编解码器（序列化/反序列化），支持不同值类型的自定义编码 |

## For AI Agents

### Working In This Directory
- 使用 `HybridCache` 时需提供 `Namespace`（如 `"channel_affinity:v1"`），确保不同业务隔离。
- `RedisEnabled` 函数字段（通常传 `func() bool { return common.RedisEnabled }`）控制运行时 Redis 开关，支持热切换。
- `Memory` 字段是一个工厂函数（`func() *hot.HotCache[string, V]`），延迟初始化 in-memory cache，首次使用时通过 `sync.Once` 创建。
- **Rule 1**：`ValueCodec` 实现中的序列化/反序列化必须使用 `common.Marshal`/`common.Unmarshal`。
- Redis 操作设有超时常量（`defaultRedisOpTimeout=2s`、`defaultRedisScanTimeout=30s`），修改时注意不要引入无超时的阻塞调用。

### Testing Requirements
- 此包目前无独立测试文件，功能由上层调用方集成测试覆盖。
- 新增功能后建议添加 `hybrid_cache_test.go`，使用 mock Redis client 测试降级路径。
- 运行命令：`go test ./pkg/cachex/...`

### Common Patterns
```go
// 典型初始化
cache := cachex.NewHybridCache(cachex.HybridCacheConfig[MyType]{
    Namespace:    "my_feature:v1",
    Redis:        common.RDB,
    RedisCodec:   myCodec,
    RedisEnabled: func() bool { return common.RedisEnabled },
    Memory:       func() *hot.HotCache[string, MyType] { return hot.NewHotCache[string, MyType](...) },
})
```

## Dependencies

### Internal
- `common` — `RedisEnabled`、`Marshal`/`Unmarshal`（通过 codec）

### External
- `github.com/go-redis/redis/v8` — Redis 客户端
- `github.com/samber/hot` — 进程内 hot cache（LFU/LRU，支持 TTL）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
