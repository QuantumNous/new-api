# 飞书组织映射到分组/套餐（任务11）详细方案（仅方案，不实现）

## 1. 目标与边界

- 目标：基于飞书组织信息（部门路径/岗位）自动决定用户分组与订阅套餐，并支持可视化预览、批量应用、审计、回滚。
- 边界：不做全量组织树镜像；采用“按需拉取 + 本地缓存 + 可重算”。

## 2. 核心决策

- 数据来源：登录时或管理员批量初始化时，通过飞书 API 获取用户组织信息。
- 存储策略：仅落库用户侧必要字段（`org_name`/`org_path`/`job_title`）+ 规则引擎配置表 + 执行审计日志。
- 触发方式：
1. 用户登录触发（增量实时）
2. 管理员批量同步触发（导入/修复）
3. 手动重算触发（按用户/分组/全量）

## 3. 数据模型设计

### 3.1 用户扩展字段（已具备）

- `users.org_name`：组织名称
- `users.org_path`：组织路径（建议格式：`/集团/研发/平台`）
- `users.job_title`：岗位/职级

### 3.2 新增规则表（建议）

表名：`feishu_group_plan_rules`

- `id` bigint PK
- `name` varchar(128) 规则名
- `enabled` bool
- `priority` int（数值越小优先级越高）
- `match_org_path` text（支持前缀匹配或通配符）
- `match_job_title` varchar(255)（可空，支持精确或包含匹配）
- `target_group` varchar(32)（命中后目标分组）
- `target_plan_id` bigint（命中后目标套餐）
- `stop_on_match` bool（命中后是否停止后续规则）
- `created_by` int
- `updated_by` int
- `created_at` bigint
- `updated_at` bigint

索引建议：
- `(enabled, priority)`
- `target_group`
- `target_plan_id`

### 3.3 新增执行审计表（建议）

表名：`feishu_rule_apply_logs`

- `id` bigint PK
- `batch_id` varchar(64)（一次执行批次）
- `trigger_source` varchar(32)（login/batch/manual）
- `user_id` int
- `old_group` varchar(32)
- `new_group` varchar(32)
- `old_plan_ids` text
- `new_plan_ids` text
- `matched_rule_ids` text
- `status` varchar(16)（applied/skipped/failed）
- `error_msg` text
- `operator_id` int（登录触发可为0）
- `created_at` bigint

## 4. 规则引擎执行流程

1. 拉取用户飞书信息（open_id/user_id/union_id 任一可定位）。
2. 规范化组织字段（去空格、统一路径分隔符、大小写策略）。
3. 按 `enabled=true` + `priority asc` 加载规则。
4. 逐条匹配：`org_path` + `job_title` 组合命中。
5. 计算目标状态：`target_group` + `target_plan_id`。
6. 生成变更集（group 变更 + bind_group 订阅同步）。
7. 事务应用（用户更新 + 订阅同步 + 审计日志）。
8. 刷新缓存（用户缓存、订阅相关缓存）。

## 5. 管理端能力设计

### 5.1 规则管理页

- 列表：规则名、优先级、匹配条件、目标分组、目标套餐、状态。
- 操作：新增、编辑、启停、删除、优先级调整。

### 5.2 预览影响范围

- 输入执行范围（用户ID列表/分组/全量），先跑“dry-run”。
- 输出：将变更的用户数、分组变化、套餐变化、冲突/失败明细。

### 5.3 一键应用

- 基于预览快照确认执行，生成 `batch_id`。
- 支持异步任务执行 + 进度查询。

### 5.4 回滚快照

- 每次应用前生成“前状态快照”（group + active bind_group subscriptions）。
- 支持按 `batch_id` 回滚。

## 6. 冲突与优先级策略

- 默认“首条命中生效”（按 `priority asc`）。
- 多条命中且 `stop_on_match=false` 时，允许继续匹配并覆盖 `target_plan_id`，但 `target_group` 仅允许首次写入（避免抖动）。
- 同级冲突：阻断保存并提示规则冲突。

## 7. 接口建议（后端）

- `GET /api/user/admin/feishu/rules`
- `POST /api/user/admin/feishu/rules`
- `PUT /api/user/admin/feishu/rules/:id`
- `PATCH /api/user/admin/feishu/rules/:id/status`
- `POST /api/user/admin/feishu/rules/preview`
- `POST /api/user/admin/feishu/rules/apply`
- `POST /api/user/admin/feishu/rules/rollback`
- `GET /api/user/admin/feishu/rules/batches/:batch_id`

## 8. 风险与防护

- 风险1：规则配置错误导致大范围误分组。
  - 防护：强制预览、二次确认、批次回滚。
- 风险2：飞书 API 抖动导致执行失败。
  - 防护：本地缓存优先、失败重试、幂等批次。
- 风险3：批量执行对数据库压力过大。
  - 防护：分片分页执行、限速、异步队列。

## 9. 灰度落地步骤

1. 上线数据表与只读规则页（不开启应用）。
2. 接入预览接口，验证命中准确率。
3. 小范围（单部门）启用一键应用。
4. 扩到全量并启用登录触发。
5. 持续观测指标：命中率、失败率、回滚率、执行耗时。

## 10. 验收标准

- 规则命中结果与人工预期一致（抽样 > 95%）。
- 应用任务可审计、可回滚、幂等。
- 登录触发链路平均耗时不显著增加（P95 可控）。
- 不出现跨库兼容问题（SQLite/MySQL/PostgreSQL 均可运行）。
