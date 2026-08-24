# Playground 对话持久化与自动恢复设计

## 背景

当前 Playground 的消息、配置和参数开关只保存在浏览器 `localStorage`。服务端 `/pg/chat/completions` 负责鉴权、渠道分发和请求中继，但没有保存 Playground 对话正文。现有 `logs` 表只记录模型、Token、额度、渠道、请求 ID 和错误等调用元数据，不能恢复聊天内容，也不适合承载大段业务正文。

这会带来三个问题：

1. 换浏览器或本地缓存丢失后无法恢复聊天。
2. 对话正文没有进入数据库，无法用于后续数据分析。
3. 现有 Playground `localStorage` key 未按用户隔离，同一浏览器切换账号时可能读取上一个账号的历史。

## 目标

- 只保存功能上线后新产生的 Playground Chat Completions 对话，不补传现有未隔离的旧 `localStorage` 历史。
- 保存完整明文的用户输入、模型回复、推理内容、请求配置和分析元数据。
- 默认长期保留；退出登录、清理浏览器缓存或清空当前聊天都不删除数据库历史。
- 重新登录或换浏览器打开 Playground 时，自动恢复该用户当前会话。
- 第一版只自动恢复当前会话，不提供历史会话列表、管理后台查询或 CSV 导出。
- 使用一个独立的新表，不扩展现有 `logs` 表。
- 支持 SQLite、MySQL 和 PostgreSQL，并在生产多节点部署中保持幂等和一致。

## 非目标

- 不回填上线前的 `playground_messages`、`playground_config` 或 `playground_parameter_enabled`。
- 不让普通用户或管理员在第一版浏览、搜索或导出历史会话。
- 不保存图片、音频或视频的 base64 二进制；多模态内容只保存 URL、媒体类型和相关文本。
- 不修改通用 `/v1` API 客户端的行为；功能只作用于登录用户使用的 Playground。
- 不把对话正文写入调用日志或应用日志。

## 方案选择

采用“每次 Playground 发送一行”的独立 `playground_records` 表。

未采用的方案：

- 每条 role message 一行：查询结构更规范，但流式回复、重试、重新生成和 UI 版本恢复需要跨多行协调，第一版复杂度较高。
- 扩展 `logs` 表：会把长期保留的大段正文与可独立清理的调用日志耦合，并显著放大日志表。
- 每个会话一行并持续覆盖 JSON：恢复简单，但不利于逐次请求分析，也丢失每次发送的独立状态和耗时。

## 数据模型

新增主库表 `playground_records`。每次发送产生一条 `turn` 记录；清空当前会话产生一条轻量 `clear` 状态记录，仍使用同一张表。`clear` 记录用于避免延迟重试把已清空会话重新设为当前会话，其正文列为空。

字段如下：

| 字段 | 说明 |
| --- | --- |
| `id` | GORM 自增主键 |
| `record_id` | 客户端生成的 UUID；与 `user_id` 组成唯一键，作为幂等键 |
| `record_type` | `turn` 或 `clear` |
| `conversation_id` | 客户端生成的会话 UUID |
| `user_id` | 服务端从登录会话取得，前端不可指定 |
| `user_message` | 当前轮用户消息 JSON，保留文本和 URL 型多模态内容 |
| `request_messages` | 本次发送给模型的规范化上下文 JSON |
| `assistant_message` | 最终助手消息 JSON，保留 UI 所需的版本和内容结构 |
| `reasoning_content` | 便于分析的纯文本推理内容 |
| `input_text` | 便于分析的当前轮用户纯文本 |
| `output_text` | 便于分析的助手纯文本 |
| `model_name` | 本次实际请求模型 |
| `group_name` | 本次 Playground 分组 |
| `parameters` | 温度、top_p、max tokens 等启用参数 JSON |
| `status` | `complete`、`error`、`stopped` 或 `cleared` |
| `error_code` | 失败时的错误码 |
| `error_message` | 失败时的错误信息 |
| `relay_request_id` | 对应中继请求 ID，便于与 `logs.request_id` 关联 |
| `prompt_tokens` | 响应可提供时保存，否则为 0 |
| `completion_tokens` | 响应可提供时保存，否则为 0 |
| `total_tokens` | 响应可提供时保存，否则为 0 |
| `latency_ms` | 从发送到终态的客户端观测耗时 |
| `messages_snapshot` | 当前会话最终 UI 消息快照；只在该会话最新记录保留 |
| `is_latest` | 是否为该会话最新记录 |
| `is_current` | 该会话是否为用户当前会话；同一用户最多一个当前会话 |
| `client_completed_at` | 客户端进入终态的时间，用于延迟重试排序 |
| `created_at`、`updated_at` | 服务端数据库时间 |

索引与约束：

- 唯一索引：`(user_id, record_id)`。
- 恢复索引：`(user_id, is_current, is_latest)`。
- 会话查询索引：`(user_id, conversation_id, created_at)`。
- `record_type`、`status`、`model_name` 和 `created_at` 建立适合后续分析的普通索引时，应以实际查询量为准；第一版只添加恢复和幂等所需索引，避免过早增加写放大。

正文和 JSON 不使用数据库专有 JSON 运算。实现一个跨数据库的大文本类型：MySQL 映射为 `LONGTEXT`，PostgreSQL 和 SQLite 映射为 `TEXT`。JSON 序列化统一使用 `common.Marshal` 和 `common.Unmarshal`。

`playground_records` 注册到普通和快速迁移路径的 `AutoMigrate` 列表。数据位于主库 `DB`，不位于可能独立配置和清理的 `LOG_DB`。

## 服务端 API

新增需要 `middleware.UserAuth()` 的 API：

### `POST /api/playground/records`

保存一个终态 `turn` 记录。请求包含记录和会话 ID、消息内容、请求配置、终态、可用的 Token 数据、耗时、客户端完成时间及完整 UI 快照。

服务端行为：

1. 从 Gin 登录上下文取得 `user_id`，忽略或拒绝请求体中的用户字段。
2. 校验 UUID、枚举、时间、正文大小和 JSON 结构。
3. 递归拒绝 `data:*;base64,`、`b64_json` 等内嵌二进制媒体字段；URL 型媒体保留。
4. 以 `(user_id, record_id)` 幂等保存。重复请求更新同一行，不新增记录。
5. 在数据库事务中锁定用户行，串行化同一用户在不同应用节点上的当前会话切换。
6. 同一会话按 `(client_completed_at, record_id)` 比较新旧；只有较新的记录才能接管 `is_latest`。幂等重试保留首次服务端创建时间，延迟到达的旧记录不会覆盖较新的恢复快照。
7. 新记录接管最新状态时，清除同会话上一行的 `messages_snapshot`，避免完整历史在每一轮重复存储。
8. 已存在 `clear` 记录的会话不能再次成为当前会话；清空后的发送必须使用新的 `conversation_id`。

### `GET /api/playground/records/current`

读取当前登录用户 `is_current = true AND is_latest = true` 的记录，返回 `conversation_id` 和 `messages_snapshot`。没有当前会话时返回成功和空数据，不返回其他用户记录。

### `POST /api/playground/records/clear`

请求包含当前 `conversation_id` 和新的幂等 `record_id`。服务端在事务中写入 `clear` 状态记录，并把该用户现有当前会话设为非当前状态。历史 `turn` 记录和最后快照继续长期保留，但 `GET current` 返回空数据。

所有接口使用项目统一成功/错误响应格式。持久化接口不参与模型计费，也不经过 Relay 的渠道分发中间件。

## 前端数据流

### 用户隔离

新增版本化、按数值用户 ID 命名的 Playground key，至少覆盖：

- 消息缓存与当前 `conversation_id`。
- Playground 配置和参数开关。
- 待同步记录队列。

上线后不读取也不迁移原来的未隔离 key，从而避免把上一个账号的旧本地消息归属到当前账号。退出登录只清认证状态，不删除用户专属 Playground key；重新登录同一账号仍可将其作为缓存使用。

### 保存

1. 用户发送时生成 `record_id`，记录开始时间，并保留本次规范化请求快照。
2. 流式 chunk 只更新现有 UI 状态和用户专属本地消息缓存，不逐 chunk 写数据库。
3. 回复完成、请求失败或用户手动停止时，生成最终记录并进入本地待同步队列。
4. 调用 `POST /api/playground/records`。成功后按 `record_id` 从队列删除；失败时保留，后续按 FIFO 重试。
5. 保存失败不改变已经展示的模型回复，只给出非阻塞提示并保留重试状态。

### 自动恢复

1. Playground 获得当前 `user_id` 后，先加载该用户的本地缓存，避免空白闪烁。
2. 先按顺序提交待同步记录；若提交失败，继续显示本地缓存且本轮不使用空服务端结果覆盖它。
3. 待同步队列处理成功后调用 `GET /api/playground/records/current`。
4. 服务端存在当前快照时，以数据库快照替换本地消息并更新本地 `conversation_id`。
5. 服务端明确返回“无当前会话”时清空该用户的本地消息；网络或服务端错误时继续使用本地缓存。

因此，同账号换浏览器或清浏览器缓存后可以从数据库恢复；退出后换账号不会看到前一个账号的内容。

### 清空或新对话

点击现有清空操作时，先调用 `POST /api/playground/records/clear`。成功后清除当前用户本地消息、待同步的同会话 UI 状态并生成新的 `conversation_id`。接口失败时不假装清空成功，避免刷新后旧会话再次恢复。

## 并发与多节点

- 幂等依赖数据库唯一键，不依赖进程内存。
- 当前会话和最新快照切换在数据库事务内完成，并锁定用户行；MySQL 和 PostgreSQL 使用行锁，SQLite 由写事务串行化。
- 同一会话的多标签页请求按 `(client_completed_at, record_id)` 判断较新快照；不同会话同时写入时，以服务端在用户行锁内接受的事务顺序决定当前会话。旧记录仍落表，但不能覆盖同会话的更新快照。
- `clear` 作为持久化状态记录参与排序，避免清空前的延迟重试恢复旧会话。
- 不新增本地定时任务、单节点队列或依赖粘性会话的状态。

## 安全与隐私

- 所有读写接口必须登录；数据读取严格按服务端 `user_id` 过滤。
- 不在 API 响应或日志中输出完整正文。
- 服务端把单次保存请求限制为 16 MiB，把嵌套 JSON 深度限制为 32 层，防止超大请求和递归结构滥用；超限时保留本地待同步状态并返回明确错误。
- 数据为用户和模型的完整明文，长期保留。数据库权限、备份和访问审计沿用主库安全控制；未来增加分析或管理接口时必须单独设计权限和脱敏策略。

## 错误处理

- 保存失败：聊天结果照常展示，记录留在用户专属重试队列。
- 恢复失败：保留本地缓存，不以空数据覆盖。
- 重复保存：返回成功并保持单行。
- 非法或含 base64 的记录：返回参数错误，不写入部分数据。
- 清空失败：不清本地聊天，并允许用户重试。
- 数据库事务失败：整体回滚，不产生两个最新快照或半完成的 clear 状态。

## 测试策略

按 TDD 顺序先写失败测试，再实现最小功能。

后端测试：

- GORM 迁移、跨数据库大文本类型映射和索引定义。
- 首次保存、终态字段、幂等重复保存、旧重试不覆盖新快照。
- 同一用户会话切换、清空后恢复为空、历史正文仍保留。
- 不同用户使用相同 `record_id` 互不影响，读取不能越权。
- complete、error、stopped、clear 枚举和非法输入。
- base64 媒体拒绝、URL 媒体保留、记录体积限制。
- API 路由鉴权、统一响应和事务错误。

前端测试：

- 用户隔离 storage key，不读取上线前旧 key。
- complete、error 和 stopped 三种终态只生成一次待同步记录。
- 保存成功移除队列；失败保留；重新打开后按顺序重试。
- 服务端快照自动恢复并覆盖缓存。
- 恢复失败时保留缓存；服务端明确无当前会话时清空缓存。
- 清空成功和失败行为，以及账号切换隔离。

验证命令至少包括相关 Go 单元测试、Playground Vitest、前端 typecheck、Go build；完整 lint/build 根据仓库现状和改动范围执行并报告任何既有失败。

## 验收标准

1. 上线后完成、失败或停止的 Playground Chat 请求最终在 `playground_records` 中各有一条对应记录，重试不重复。
2. 新记录包含完整明文输入、回复、推理、请求配置、终态和可用的分析元数据。
3. 退出并重新登录或换浏览器后，自动恢复该用户当前会话。
4. 清空当前聊天后刷新仍为空，但旧数据继续存在于数据库。
5. 同一浏览器切换账号不会展示或上传另一个账号的历史。
6. 旧的未隔离 `localStorage` 数据不被补传。
7. SQLite、MySQL 和 PostgreSQL 均能迁移和运行；多节点并发不会产生重复记录或多个当前最新快照。
8. 图片、音频和视频只保存 URL/类型，不保存 base64 二进制。

## 发布说明

本功能包含主库 schema 迁移、用户鉴权 API 和 console Playground 前端变更。需要部署 `newapi-console`；由于共享 Go 二进制启动时执行主库迁移，生产 router 节点也需要使用兼容该 schema 的同版本或经过明确验证的部署顺序。部署前应在 staging 验证迁移、登录恢复、账号切换、清空、流式停止和失败重试。功能上线后才开始采集，不运行历史回填脚本。
