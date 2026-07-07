# 自动分组建议工作台设计

## 背景

当前自动分组已验证：只靠「岗位 -> 分组」不够。同名岗位会出现在不同组织层级里，继续叠加路径、部门、组织字段规则，会把系统变成难维护的规则工程。

用户明确指出：

- 精确组织路径很难定期录入和维护。
- 管理员无法穷尽所有岗位。
- 页面和规则不能继续变复杂。

因此本方案放弃“让管理员配置复杂多条件规则”的方向，改为：

```text
身份分类器 + 待确认队列 + 人工确认沉淀规则
```

核心思想：系统先用稳定业务定义自动识别高置信度用户；识别不了的用户进入待确认；管理员确认的是“人”，不是维护复杂规则；系统再把确认结果沉淀为少量可解释的补充规则。

## 主要矛盾

自动分组真正要解决的不是“字符串怎么匹配”，而是：

```text
一个人在组织里的权限身份是什么？
```

岗位、部门、组织路径只是身份线索，不是身份本身。

因此产品不应暴露复杂规则引擎，而应提供一个分组建议工作台。

## 目标

1. 高置信度用户自动分组。
2. 同名岗位、冲突岗位不乱改，进入待确认。
3. 管理员只处理待确认用户，不维护大量规则。
4. 人工确认后，系统可沉淀为少量补充规则。
5. 每次自动判断都能解释：为什么建议这个分组。
6. 保留保护分组机制，避免覆盖特殊账号和高权限账号。
7. 一键初始化从“生成岗位规则”改为“回放当前用户并生成建议队列”。

## 非目标

1. 不做复杂可视化规则编辑器。
2. 不要求管理员录完整组织路径。
3. 不要求系统一次性自动分准所有用户。
4. 不引入机器学习模型。
5. 不改变现有分组、订阅套餐和权限体系。

## 产品形态

自动分组页面改为 4 个 Tab。

### Tab 1：概览

展示当前自动分组状态：

```text
自动命中人数
待确认人数
跳过人数
保护分组人数
最近一次回放时间
最近一次自动变更人数
```

主要操作：

```text
回放当前用户
应用高置信度自动分组
查看最近变更
```

### Tab 2：待确认用户

这是主工作台。

表格字段：

| 字段 | 说明 |
|---|---|
| 用户 | 显示名、邮箱 |
| 当前分组 | 当前系统分组 |
| 建议分组 | 系统建议 |
| 置信度 | high / medium / low |
| 岗位 | 飞书岗位 |
| 组织摘要 | 一级组织、所在部门、上级部门 |
| 原因 | 命中哪些身份线索 |
| 操作 | 确认、改分组、跳过、加入保护 |

操作语义：

- **确认**：把用户改到建议分组，并记录这次人工确认。
- **改分组**：选择正确分组，并记录人工确认。
- **跳过**：本轮不处理。
- **加入保护**：以后不被自动规则覆盖。

### Tab 3：身份规则

不展示底层复杂条件，只展示少量业务可读规则。

例如：

```text
城区SC
- 城区总经理
- 城区市场总监
- 城区三保交付总监
- 城区解决方案总监

城区级职能部门
- 岗位包含 城区财务BP
- 岗位包含 城区人力行政共享 且 一级组织为 人力资源中心
- 城区保洁专业经理
```

管理员可以启用/禁用这些身份规则，但不需要维护完整路径。

### Tab 4：回放记录

展示每次回放结果：

```text
本次扫描用户数
自动命中数量
待确认数量
跳过数量
与当前分组不一致数量
规则覆盖率
```

支持查看详情：

```text
谁会被改
为什么改
谁无法判断
谁被保护跳过
```

## 后端核心模型

### 身份分类结果

```go
type AutoGroupDecision struct {
    UserID       int
    CurrentGroup string
    SuggestedGroup string
    Confidence   string // high, medium, low
    Action        string // auto_apply, confirm_required, skip
    Reason        string
    Source        string // builtin_rule, learned_rule, protected, no_match
}
```

### 建议队列表

新增表：`auto_group_suggestions`

| 字段 | 说明 |
|---|---|
| id | 主键 |
| user_id | 用户 ID |
| current_group | 当前分组 |
| suggested_group | 建议分组 |
| confidence | high / medium / low |
| action | auto_apply / confirm_required / skip |
| reason | 判断原因 |
| source | builtin_rule / learned_rule / protected / no_match |
| status | pending / confirmed / rejected / skipped / applied |
| snapshot_json | 用户组织快照 JSON |
| created_at | 创建时间 |
| updated_at | 更新时间 |

说明：`snapshot_json` 使用 `TEXT` 存储，JSON 编解码必须用 `common.Marshal` / `common.Unmarshal`。

### 人工确认记录表

新增表：`auto_group_confirmations`

| 字段 | 说明 |
|---|---|
| id | 主键 |
| user_id | 用户 ID |
| job_title | 确认时岗位 |
| org_level1_name | 一级组织 |
| org_level2_name | 二级组织 |
| parent_department_name | 上级部门 |
| department_name | 所在部门 |
| org_path | 部门路径 |
| from_group | 原分组 |
| confirmed_group | 确认分组 |
| operator_id | 操作管理员 |
| created_at | 创建时间 |

这张表用于审计，也用于后续生成 learned rule。

### 补充规则表

新增表：`auto_group_learned_rules`

只存人工确认后沉淀出的少量规则，不存复杂完整路径。

| 字段 | 说明 |
|---|---|
| id | 主键 |
| target_group | 目标分组 |
| job_title_keyword | 岗位关键词，可空 |
| department_keyword | 所在部门关键词，可空 |
| parent_department_keyword | 上级部门关键词，可空 |
| org_level1_keyword | 一级组织关键词，可空 |
| confidence | 置信度 |
| enabled | 是否启用 |
| sample_count | 来源样本数 |
| remark | 备注 |
| created_at | 创建时间 |
| updated_at | 更新时间 |

原则：只有当多次人工确认形成稳定模式时，才生成 learned rule。

## 身份分类器

分类器分两层。

### 1. 内置身份规则

这些是业务定义，直接写在代码里，不要求管理员维护。

#### 城区SC

用户已确认：

```text
岗位 = 城区三保交付总监 -> 城区SC
岗位 = 城区解决方案总监 -> 城区SC
岗位 = 城区总经理 -> 城区SC
岗位 = 城区市场总监 -> 城区SC
```

#### 城区级职能部门

用户已确认：

```text
岗位包含 城区财务BP -> 城区级职能部门
岗位包含 城区人力行政共享 且 一级组织名称 = 人力资源中心 -> 城区级职能部门
岗位 = 城区保洁专业经理 -> 城区级职能部门
```

#### 项目BMG

当前数据高置信度：

```text
岗位包含 物业项目 -> 项目BMG
岗位 = 项目经理（合资职位） -> 项目BMG
```

#### 集团高层

`集团高层` 不进入自动分组。该分组权限敏感，统一由管理员手动维护，并默认加入保护分组。

分类器遇到疑似集团高层岗位时，只返回 `confirm_required` 或 `skip`，不自动改入 `集团高层`。

#### 事业部SC

当前数据高置信度：

```text
岗位 = CEO -> 事业部SC
岗位 = COO -> 事业部SC
岗位 = CMO -> 事业部SC
岗位 = 大区CEO -> 事业部SC
岗位 = 大区COO -> 事业部SC
岗位 = 大区CMO -> 事业部SC
```

#### itbp

`itbp` 不进入自动分组。该分组和技术/产品支持关系更复杂，容易混入特殊授权场景，统一由管理员手动维护，并默认加入保护分组。

分类器可以把疑似 ITBP 用户列为待确认，但不自动改入 `itbp`。

### 2. Learned Rules

系统从人工确认记录中提炼补充规则。

首期可以先不自动生成，只记录确认。后续再加“生成规则建议”：

```text
同一岗位 + 同一部门关键词 + 同一确认分组 出现 N 次
=> 建议生成 learned rule
```

管理员确认后才启用。

## 判断流程

```text
1. 用户在保护分组中：skip
2. 组织/岗位关键字段缺失：skip 或 confirm_required
3. 命中内置高置信度身份规则：auto_apply
4. 命中 learned rule：auto_apply 或 confirm_required，取决于 confidence
5. 同岗位历史上存在多分组冲突：confirm_required
6. 无法判断：confirm_required 或 skip
```

默认安全策略：

```text
只有 high confidence 才自动应用。
medium / low 只进入待确认。
```

## 保护分组

建议默认保护：

```text
agentone
测试
组织智能体专用
集团高层
一级部门责任人
itbp
```

`default` / `pending` 不建议默认保护，否则新用户无法从 pending 自动转正。它们可以作为待处理来源分组。

## API 设计

### 概览

```http
GET /api/auto-group/dashboard
```

返回：

```json
{
  "total_users": 315,
  "auto_apply_count": 120,
  "confirm_required_count": 40,
  "skip_count": 20,
  "protected_count": 10,
  "last_replay_at": 1780000000
}
```

### 回放

```http
POST /api/auto-group/replay
```

行为：

- 扫描当前用户。
- 生成/刷新 `auto_group_suggestions`。
- 不直接修改用户分组。

### 应用高置信度结果

```http
POST /api/auto-group/apply-high-confidence
```

行为：

- 只应用 `action=auto_apply` 且 `confidence=high` 的建议。
- 跳过保护分组。
- 更新用户分组后复用现有订阅同步。

### 待确认列表

```http
GET /api/auto-group/suggestions?status=pending
```

### 确认建议

```http
POST /api/auto-group/suggestions/:id/confirm
```

请求：

```json
{
  "group": "城区SC"
}
```

行为：

- 更新用户分组。
- 记录确认。
- 标记 suggestion confirmed/applied。
- 触发订阅同步。

### 跳过建议

```http
POST /api/auto-group/suggestions/:id/skip
```

### 身份规则列表

```http
GET /api/auto-group/identity-rules
```

返回内置规则和 learned rules，用于页面展示。

## 与现有功能的关系

### 保留

- 受保护分组配置。
- 自动分组后同步订阅套餐。
- OAuth 创建用户后尝试自动判断。
- 飞书同步后尝试自动判断。

### 改造

- 当前“岗位规则表”页面改为“自动分组建议工作台”。
- 当前“一键初始化”改为“回放当前用户”。
- 当前“测试匹配”弱化为某个用户的“查看判断原因”。

### 兼容

旧 `group_mapping_rules` 可以暂时保留：

- 如果存在旧岗位规则，可以作为 learned rule 来源。
- 新页面不再强调岗位规则 CRUD。

## 前端设计

页面路径保持：

```text
/auto-group-rules
```

菜单名称可以改为：

```text
自动分组
```

页面主标题：

```text
自动分组建议工作台
```

主要按钮：

```text
回放当前用户
应用高置信度结果
保护分组设置
```

待确认表格是核心，不再把匹配测试放主页面。

## 测试计划

### 分类器单元测试

1. 城区三保交付总监 -> 城区SC。
2. 城区解决方案总监 -> 城区SC。
3. 城区总经理 -> 城区SC。
4. 城区市场总监 -> 城区SC。
5. 岗位包含城区财务BP -> 城区级职能部门。
6. 城区人力行政共享 + 一级组织人力资源中心 -> 城区级职能部门。
7. 城区保洁专业经理 -> 城区级职能部门。
8. 保护分组跳过。
9. 空岗位不 panic。
10. 冲突岗位进入 confirm_required。

### 行为测试

1. replay 生成建议但不修改用户。
2. apply-high-confidence 只应用高置信度。
3. confirm suggestion 修改用户分组并记录确认。
4. 分组变更后触发订阅同步。
5. protected group 用户不被覆盖。

### 回放测试

使用 `users-2026-07-07.csv` 回放：

- 自动命中人数。
- 待确认人数。
- 跳过人数。
- 与当前分组不一致人数。
- 冲突岗位清单。

## 分阶段落地

### 第一阶段：安全可用

1. 新增分类器。
2. 新增 suggestion 表。
3. 实现 replay。
4. 实现 apply high confidence。
5. 页面改为概览 + 待确认列表。

### 第二阶段：人工确认闭环

1. 实现确认/改分组/跳过。
2. 记录 confirmation。
3. 回放记录展示。

### 第三阶段：沉淀规则

1. 从确认记录发现稳定模式。
2. 生成 learned rule 建议。
3. 管理员确认后启用。

## 结论

新方向是：

```text
不要让管理员维护复杂规则。
让系统做判断，让管理员只处理不确定的人。
```

这样可以避免：

- 精确路径维护成本高。
- 岗位穷举不现实。
- 多条件规则页面越来越复杂。
- 低置信度自动改错权限。

首批内置规则直接覆盖已经确认的城区SC、城区级职能部门，以及当前数据中高度稳定的项目BMG、事业部SC。`集团高层` 和 `itbp` 默认由管理员手动维护并加入保护分组。冲突岗位全部进入待确认，由管理员确认后再逐步沉淀。