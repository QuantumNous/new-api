# 敏感词内容审计重构

## 范围与基线

本设计在官方 `QuantumNous/new-api` 的 `d04c118c8803f49e0c9bab74dcf5b5efeab9464a` 基线之上重建敏感词内容审计功能。它只涵盖请求进入 Relay 前的敏感词检查、审计、违规计数、阈值停用和管理员管理界面；不改变额度、已用额度、订阅、钱包、历史账务或上游重试策略。

旧 `SensitiveWords`、`SensitiveWordConfig` 和旧 `word/enabled` 规则列只作为一次性迁移输入。用户白名单只使用新的 `users.sensitive_word_whitelist` 字段。运行时不再读取旧 Option，也不再使用旧 `RequestPolicySnapshot.CheckText/TextKeywords` 或 `service/sensitive.go`。

## 数据流

```text
协议 DTO 提取可检查文本
        |
middleware.Distribute：有效分组解析完成、选渠道前预检
        |
候选分组 + Aho-Corasick 快照（单次扫描）
        |
主库事务：锁定用户、审计、计数、必要时禁用
        |
  422 sensitive_words_detected  或  缓存决定 -> 选渠道 -> 估算/预扣费/上游
```

`middleware.Distribute` 在协议请求已可解析、有效分组已确定但尚未调用 `SelectChannelForRequest` 时执行策略，因此本地阻断优先于无可用渠道或模型不存在。Responses WebSocket 不经过 `Distribute`，其已解析的 `response.create` DTO 会调用同一预检函数，位置同样位于渠道选择和上游握手之前。结果放入请求上下文；`PrepareRequestBilling` 复用该结果，以确保一个请求只匹配和审计一次，并在未经过分发中间件的调用场景保留同样的计费前兜底。审计事务失败时返回不可重试 `503`，不会以未记录的结果放行。命中阻断规则时返回 `422 sensitive_words_detected` 并跳过重试。用户已被阈值禁用后，令牌鉴权稳定返回不可重试 `403 user_banned`。

OpenAI Chat、HTTP/ WebSocket Responses、Claude、Gemini 和图片请求均通过各自 DTO 的 `GetTokenCountMeta().CombineText` 进入检查。Responses 的 `function_call_output.output` 支持字符串、内容数组和 JSON 对象，保留请求原始 wire shape。

## 规则与运行时

规则由 `sensitive_word_rules`、`sensitive_word_rule_words` 和 `sensitive_word_rule_groups` 组成：

| 约束 | 值 |
| --- | --- |
| 作用域 | `global` 或使用真实定价分组的 `group` |
| 模式 | `block`、`observe`、`off` |
| 新规则默认模式 | `observe` |
| 单词条长度 | 最多 200 个字符 |
| 单规则词条数 | 最多 10,000 |
| 匹配 | 大小写不敏感的 Aho-Corasick |

规则、策略或模式更新在同一事务中递增 `sensitive_word_policy.version`，并使本进程快照失效。每个节点用该持久化版本校验自己的快照，因此另一节点完成规则修改后，本节点的下一次请求会重建 automaton，而不依赖进程内广播。自动分组按候选顺序评估，单次 automaton 扫描收集候选分组可用的全局和局部规则，避免按候选分组重复扫描提示词。

## 策略、审计与账号状态

单例 `sensitive_word_policy` 保存策略。默认阈值为 50，完整提示词留存 180 天，提示词最多 65,536 个字符和 512 KiB。完整证据、脱敏预览和命中片段在到期后清空，审计事实及账号处理结果保留。

审计写入 `sensitive_word_audit_events`，包含请求、协议、分组、规则版本、命中信息、提示词哈希、证据留存状态、违规次数和前后账号状态。请求 ID 与用户 ID 共同保证重复请求不会重复计数。

所有会改变用户安全状态的路径都在同一事务内使用 `lockForUpdate(tx)`：

- 阻断命中：仅增加 `sensitive_word_violation_count`。
- 达到阈值：仅更新 `status`、违规次数和 `auth_version`。
- 管理员 `POST /api/user/manage` 的 `action=enable`：启用账号并将违规次数归零。

提交后，停用和重新启用都会依次尝试 `PublishUserAuthCache`、`RevokeAllUserSessions`、`InvalidateUserTokensCache`。这些异步失效步骤任一失败不会回滚已提交的安全状态，也不会阻止剩余步骤执行；系统日志会记录失败以便运维补偿。

## 日志与隐私

命中事件写入使用日志类型 `8`。新日志的公开部分仅写入 `other.action=sensitive_word_block`；规则、命中词、`audit_id`、哈希和处理结果写入 `other.admin_info.keyword_filter`。普通用户投影会移除 `admin_info`、历史顶层 `audit_id` 和 `keyword_filter`；管理员审计详情同时兼容历史顶层字段。

完整提示词只由 `GET /api/log/sensitive-word-audit/:id` 返回，路由受 `AdminAuth` 保护。用户使用日志及普通用户 API 不返回证据、命中词或审计 ID。

## 管理接口与界面

保持以下接口：

- `GET|PUT /api/sensitive-words/policy`
- `GET /api/sensitive-words/groups`
- `GET|POST /api/sensitive-words/rules`
- `GET|PUT|DELETE /api/sensitive-words/rules/:id`
- `PATCH /api/sensitive-words/rules/:id/mode`
- `GET /api/log/sensitive-word-audit/:id`
- `POST /api/user/manage` 的 `action=enable`

管理界面位于 `/system-settings/request-policies/filtering`。旧 `/system-settings/security/sensitive-words` 路由保持重定向。规则弹窗支持一行一个词、TXT 导入、大小写不敏感草稿搜索、首次命中选择、Enter/Shift+Enter 循环命中，并在关闭时清空搜索状态。用户编辑抽屉从左侧打开，可维护白名单和违规次数；启用有违规记录的用户会要求确认重置。

## 单向迁移

启动先自动迁移新表与用户字段，再运行 `MigrateSensitiveWordData`。迁移顺序为策略、旧规则词条和旧 Option，全部成功后才写入 `SensitiveWordRulesMigrationVersion=2`。所有节点都要求该标记存在才启用新运行时，避免从节点在主节点导入旧数据期间使用部分规则。标记存在后旧值永不重新成为运行时权威；不完整或失败的迁移使新运行时失效并保持 fail-open，服务本身继续启动。迁移完成后的策略或迁移标记数据库读取异常则是不可确定的安全状态，Relay 返回不可重试 `503`，不会静默绕过审计。

迁移必须在全新库、RC40 升级和旧版敏感词结构上连续执行两次。MySQL 的完整提示词列为 `MEDIUMTEXT`，PostgreSQL 与 SQLite 为 `TEXT`。

## 安全控制与排障

设计对应 OWASP ASVS 5.0.0 的 V7.4.1、V7.4.2、V16.2.5、V16.3.3：状态转换经行锁与事务保护，认证版本和会话/令牌缓存失效，敏感证据按角色隔离，审计失败不会静默放行。

出现意外放行时，依次检查：策略是否启用、迁移标记和运行时是否可用、规则模式/作用域、令牌的实际或自动候选分组、Relay 的 `CombineText`、主库审计写入及类型 8 日志。对于 Responses WebSocket，还要确认 `response.create` 已进入渠道选择前的共享 DTO 预检。出现 `503` 时优先检查主库审计表、约束、连接和事务错误；出现 `403 user_banned` 时检查用户状态、`auth_version`、会话与令牌缓存失效日志。
