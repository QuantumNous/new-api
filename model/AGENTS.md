<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# model

## Purpose
model 层是 new-api 分层架构（Router→Controller→Service→Model）的最底层，负责定义数据库实体结构（GORM Model）并封装所有数据库 CRUD 操作。该层同时维护内存缓存（用户/渠道/Token 缓存），通过 Redis Pub/Sub 在多节点间同步缓存失效，是业务数据持久化的唯一出口。

## Key Files
| File | Description |
|------|-------------|
| `main.go` | 数据库初始化：连接 SQLite/MySQL/PostgreSQL，执行 AutoMigrate，初始化跨库列名变量（`commonGroupCol`、`commonKeyCol`、`commonTrueVal`/`commonFalseVal`），创建默认 root 账户 |
| `channel.go` | 渠道实体定义及 CRUD，包含模型列表解析、状态管理、PublishConfigChanged 触发缓存同步 |
| `channel_cache.go` | 渠道内存缓存层：按 ID/模型/分组索引缓存，定时从 DB 同步（60s），Redis 订阅即时失效 |
| `user.go` | 用户实体定义及 CRUD，包含密码验证（`ValidateAndFill`）、额度操作、访问 Token 验证 |
| `user_cache.go` | 用户信息内存缓存（UserBase），减少高频鉴权查询对数据库的压力 |
| `token.go` | API Token（令牌）实体定义及 CRUD，包含 Key 脱敏、IP 白名单解析、额度操作 |
| `token_cache.go` | Token 内存缓存，供 middleware 高频鉴权使用 |
| `log.go` | 请求日志实体定义及查询（支持分页、多条件过滤），支持独立日志数据库（`LOG_DB`） |
| `ability.go` | Ability 表：记录每个渠道支持的模型能力，是渠道选择的核心索引表 |
| `pricing.go` | 模型定价数据（ModelPrice）的存储与查询 |
| `task.go` | 异步任务（Midjourney/视频生成等）实体定义及状态流转 |
| `subscription.go` | 用户订阅套餐实体及生命周期管理 |
| `topup.go` | 充值记录实体及查询 |
| `errors.go` | model 层统一错误变量（`ErrDatabase`、`ErrUserEmptyCredentials` 等） |
| `option.go` | 系统配置项（key-value）的读写，启动时批量加载到内存 |
| `midjourney.go` | Midjourney 任务实体及状态查询 |

## For AI Agents

### Working In This Directory
- **Rule 1（JSON）**：model 层内的 JSON 操作必须使用 `common.Marshal` / `common.Unmarshal`，禁止直接调用 `encoding/json` 的 marshal/unmarshal（类型引用 `json.RawMessage` 等除外）。
- **Rule 2（DB 兼容）**：这是 DB 兼容规则最核心的实施层：
  - 优先使用 GORM 方法，避免原生 SQL。
  - 原生 SQL 中涉及保留字列名必须使用 `commonGroupCol` / `commonKeyCol`，不得硬编码反引号或双引号。
  - 布尔值使用 `commonTrueVal` / `commonFalseVal`，不得硬编码 `true`/`1`。
  - 使用 `common.UsingPostgreSQL` / `common.UsingSQLite` / `common.UsingMySQL` 做数据库类型分支。
  - SQLite 不支持 `ALTER COLUMN`，仅能 `ADD COLUMN`；迁移时参考 `main.go` 中已有模式。
  - 禁止使用 MySQL 专有函数（`GROUP_CONCAT`）或 PostgreSQL 专有算子（`@>`、`JSONB`）而不提供兼容回退。
- **Rule 5（保护标识）**：不得修改包路径 `github.com/QuantumNous/new-api/model` 或相关注释。
- 缓存失效通过 `publishChannelsChanged()` / Redis Pub/Sub 触发，修改渠道/用户数据后需确认是否需要发布失效通知。
- 日志实体可写入独立数据库（`LOG_DB`），查询日志时使用 `LOG_DB` 而非 `DB`。

### Testing Requirements
- 构建验证：`go build ./...`
- 单元测试：`go test ./model/...`
- 测试文件：`payment_method_guard_test.go`、`task_cas_test.go`

### Common Patterns
- 实体结构体字段使用 GORM tag 定义索引、默认值、列名（如 `gorm:"index;default:0"`）。
- 软删除字段使用 `gorm.DeletedAt`（`User`、`Token`）。
- 缓存层结构（`channel_cache.go`、`user_cache.go`、`token_cache.go`）使用 `sync.RWMutex` 保护并发读写。
- 额度操作使用 GORM 的原子更新（`Updates`/`Update` 配合条件），避免读改写竞态。
- 错误统一定义在 `errors.go`，上层通过 `errors.Is(err, model.ErrXxx)` 判断错误类型。

## Dependencies

### Internal
- `common/` — JSON 工具、数据库类型标志（`UsingPostgreSQL` 等）、Redis 客户端、加密
- `constant/` — 渠道类型、用户角色等常量
- `dto/` — 与 controller/service 层共享的传输对象
- `types/` — 错误类型
- `setting/operation_setting` — 运营配置（额度显示类型等）
- `logger/` — 结构化日志

### External
- `gorm.io/gorm` — ORM 框架
- `gorm.io/driver/mysql` / `gorm.io/driver/postgres` / `github.com/glebarez/sqlite` — 三种数据库驱动
- `github.com/bytedance/gopkg/util/gopool` — 异步写操作（日志异步入库）
- `github.com/samber/lo` — 集合工具

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
