<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# common

## Purpose
项目级共享工具包，为整个后端提供基础能力：JSON 序列化、数据库标志位、Redis 客户端、限流、加密、环境变量读取、配额换算、IP 工具、日志、系统监控等。几乎所有包都会直接 import `common`。

**核心约束**：
- `json.go` 是 **Rule 1** 的唯一实现入口，项目内所有 JSON 操作必须通过其函数调用，禁止在业务代码中直接使用 `encoding/json` 的 marshal/unmarshal。
- `database.go` 提供 `UsingSQLite`/`UsingMySQL`/`UsingPostgreSQL` 标志位，是 **Rule 2** 跨数据库兼容判断的基础。

## Key Files

### JSON（Rule 1 核心）
| File | Description |
|------|-------------|
| `json.go` | **Rule 1 核心实现**。提供 `Marshal`、`Unmarshal`、`UnmarshalJsonStr`、`DecodeJson`、`MarshalNoHTMLEscape`、`GetJsonType`、`JsonRawMessageToString`。所有 JSON 操作必须经由此文件 |

### 数据库（Rule 2 相关）
| File | Description |
|------|-------------|
| `database.go` | 数据库类型常量与标志位：`UsingSQLite`、`UsingMySQL`、`UsingPostgreSQL`、`UsingClickHouse`，所有跨 DB 条件分支依赖这些变量 |

### Redis
| File | Description |
|------|-------------|
| `redis.go` | Redis 客户端初始化（`InitRedisClient`）、`RDB` 全局实例、`RedisEnabled` 标志位、通用 Get/Set/Del 包装 |
| `redis_pubsub.go` | Redis Pub/Sub 订阅工具，用于多节点配置同步 |

### 环境变量 & 配置
| File | Description |
|------|-------------|
| `env.go` | `GetEnvOrDefault`、`GetEnvOrDefaultString`、`GetEnvOrDefaultBool` 三个带默认值的环境变量读取函数 |
| `constants.go` | 全局运行时常量（`QuotaPerUnit`、`SyncFrequency`、`DebugEnabled` 等） |
| `performance_config.go` | 性能相关配置读取 |
| `init.go` | 包级初始化逻辑 |

### 加密 & 安全
| File | Description |
|------|-------------|
| `crypto.go` | AES/SHA 加解密工具 |
| `hash.go` | Hash 工具函数 |
| `totp.go` | TOTP 两步验证工具 |
| `ssrf_protection.go` | SSRF 防护，HTTP 请求目标地址校验 |
| `url_validator.go` | URL 合法性校验 |

### 网络 & 请求
| File | Description |
|------|-------------|
| `ip.go` | 获取客户端真实 IP，处理代理头 |
| `gin.go` | Gin 框架相关工具（读取 body、设置响应等） |
| `rate-limit.go` | 内存级别限流工具（基于 `limiter/` 子包的 Redis 限流另见子目录） |
| `body_storage.go` | 请求 body 的临时存储与复用 |

### 配额 & 计费
| File | Description |
|------|-------------|
| `quota.go` | `GetTrustQuota` 等配额工具函数 |
| `topup-ratio.go` | 充值比例换算 |

### 日志 & 监控
| File | Description |
|------|-------------|
| `sys_log.go` | `SysLog`、`SysError`、`FatalLog` 系统日志函数 |
| `system_monitor.go` | 系统资源监控（CPU/内存），平台无关入口 |
| `system_monitor_unix.go` | Unix 平台监控实现 |
| `system_monitor_windows.go` | Windows 平台监控实现 |
| `pprof.go` | pprof 性能剖析注册 |
| `pyro.go` | Pyroscope 持续性能分析集成 |

### 工具类
| File | Description |
|------|-------------|
| `str.go` | 字符串工具（`MaskSensitiveInfo`、`StringToByteSlice` 等） |
| `utils.go` | 通用工具函数（`GetPointer` 等） |
| `copy.go` | 深拷贝工具 |
| `model.go` | 通用分页结构、GORM 公共列名（`commonGroupCol`、`commonKeyCol`、`commonTrueVal`、`commonFalseVal`） |
| `page_info.go` | 分页信息结构 |
| `validate.go` | 请求参数校验工具 |
| `verification.go` | 邮件验证码等验证逻辑 |
| `go-channel.go` | channel 工具函数 |
| `gopool.go` | goroutine 池 |
| `email.go` | 邮件发送（SMTP） |
| `email-outlook-auth.go` | Outlook OAuth 邮件发送 |
| `disk_cache.go` | 基于磁盘的本地缓存 |
| `disk_cache_config.go` | 磁盘缓存配置 |
| `embed-file-system.go` | 嵌入文件系统工具 |
| `endpoint_defaults.go` | 上游 API 默认 endpoint 配置 |
| `endpoint_type.go` | Endpoint 类型常量 |
| `api_type.go` | API 类型工具 |
| `audio.go` | 音频相关工具 |
| `custom-event.go` | 自定义事件推送工具 |
| `replica_id.go` | 多副本实例 ID 生成与获取 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `limiter/` | 基于 Redis + Lua 脚本的令牌桶限流器，单例模式，供 middleware 使用 |

## For AI Agents

### Working In This Directory
- **Rule 1 强制**：新增或修改任何 JSON 序列化/反序列化，必须使用 `common.Marshal`/`common.Unmarshal` 等函数，禁止直接调用 `encoding/json`。`json.RawMessage`、`json.Number` 等类型定义可以引用，但 marshal/unmarshal 调用必须走 `common.*`。
- **Rule 2 相关**：`database.go` 的标志位（`UsingSQLite`、`UsingPostgreSQL`、`UsingMySQL`）是所有跨 DB 分支的判断依据；`model.go` 的 `commonGroupCol`、`commonTrueVal` 等变量用于跨 DB 保留字列的安全引用。
- 修改 `redis.go` 时确认 `RedisEnabled` 路径下的降级逻辑仍正确。
- 修改 `limiter/` 时注意其使用 `sync.Once` 单例，勿破坏初始化顺序。

### Testing Requirements
- `json_test.go`：JSON 工具函数单元测试，修改 `json.go` 后必须跑。
- `redis_pubsub_test.go`：Redis Pub/Sub 单元测试，需要 Redis 实例。
- `url_validator_test.go`：URL 校验单元测试。
- `replica_id_test.go`：副本 ID 生成单元测试。
- 运行命令：`go test ./common/...`

### Common Patterns
- 错误日志统一用 `common.SysError(...)` / `common.SysLog(...)`，不直接用 `fmt.Println`。
- 环境变量统一用 `common.GetEnvOrDefault*`，不直接调用 `os.Getenv` 后手动转型。
- 数据库分支：`if common.UsingPostgreSQL { ... } else { ... }`。

## Dependencies

### Internal
- 无内部包依赖（`common` 是最底层基础包，不引用其他业务包）

### External
- `github.com/go-redis/redis/v8` — Redis 客户端
- `gorm.io/gorm` — ORM（仅类型引用）
- `github.com/gin-gonic/gin` — HTTP 框架（gin 工具函数）
- `golang.org/x/crypto` — 加密算法

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
