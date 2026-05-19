<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# constant

## Purpose
全局常量定义层，集中管理渠道类型编号、API 类型枚举、Gin Context 键名、缓存键名、环境变量名、任务类型、支付方式等跨包共享的常量。不包含任何业务逻辑，仅作常量声明。

## Key Files
| File | Description |
|------|-------------|
| `channel.go` | 渠道类型常量（`ChannelTypeOpenAI=1`、`ChannelTypeAnthropic=14` 等，共 50+ 类型），新增渠道时在此追加 |
| `api_type.go` | API 类型枚举（`APITypeOpenAI`、`APITypeAnthropic` 等，iota 递增），决定 relay 层选择哪个 adapter |
| `context_key.go` | `ContextKey` 类型及所有 Gin Context 键名（token、channel、user、group 等维度），避免硬编码字符串 |
| `cache_key.go` | Redis 缓存键名常量 |
| `endpoint_type.go` | Endpoint 类型常量 |
| `env.go` | 环境变量名称常量 |
| `finish_reason.go` | 大模型响应 finish_reason 常量（`stop`、`length`、`tool_calls` 等） |
| `multi_key_mode.go` | 多 Key 模式常量 |
| `azure.go` | Azure 相关常量（API 版本等） |
| `midjourney.go` | Midjourney 任务动作类型常量 |
| `task.go` | 通用异步任务状态常量 |
| `waffo_pay_method.go` | 支付方式常量 |
| `setup.go` | 系统初始化相关常量 |
| `README.md` | 渠道类型说明文档 |

## For AI Agents

### Working In This Directory
- **新增渠道**：必须同时在 `channel.go` 追加 `ChannelTypeXxx` 常量（在 `ChannelTypeDummy` 之前）、在 `api_type.go` 追加 `APITypeXxx`（在 `APITypeDummy` 之前），并在 relay 层注册对应 adapter。
- **Context 键**：所有 Gin Context 的 `c.Set`/`c.Get` 调用必须使用 `constant.ContextKeyXxx` 常量，不得硬编码字符串。
- 此包是纯常量包，禁止引入任何业务逻辑或外部依赖。
- `ChannelTypeDummy` 和 `APITypeDummy` 是哨兵值（用于计数），新增条目必须插入其之前。

### Testing Requirements
- 此包无业务逻辑，通常无独立测试文件。
- 变更后运行全量编译验证无引用错误：`go build ./...`

### Common Patterns
- 渠道类型使用具名整型常量，不使用 iota（避免顺序依赖）。
- API 类型使用 iota，新增时追加到 `APITypeDummy` 之前。
- Context 键使用 `type ContextKey string` 强类型，避免与其他包的字符串键冲突。

## Dependencies

### Internal
- 无（纯常量包，不引用任何内部包）

### External
- 无

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
