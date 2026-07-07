# 自动分组多条件降级规则设计

## 背景

当前自动分组规则是「岗位 `job_title` → 分组 `group`」的精确映射，表 `group_mapping_rules` 中 `job_title` 还是唯一键。这能覆盖一批无争议岗位，但无法处理同名岗位在不同组织层级下应分到不同分组的情况。

基于 `/Users/linbiqiu/Downloads/users-2026-07-07.csv` 的 315 条导出数据分析：

- 岗位唯一值 162 个。
- 仅用岗位按多数分组预测，准确率约 90.8%。
- 但有 16 个岗位跨多个分组冲突，影响 75 人。
- 部门路径、所在部门名称也有较强解释力，分别约 89.2% 和 87.6%。
- 一级组织、二级组织过粗，不能单独决定分组，只适合作为限定条件。

因此规则应升级为：

```text
多条件规则 → 目标分组
```

并采用“越具体越优先，未命中再降级”的匹配策略。

关键原则：**不要求管理员维护完整组织路径**。完整路径变化频繁、录入成本高，只作为系统回放和解释依据；规则维护应以稳定的组织特征为主，例如岗位关键词、一级组织、上级部门关键词、所在部门关键词、路径片段。

## 目标

1. 支持同一岗位在不同组织层级、不同部门路径下映射到不同分组。
2. 支持无争议岗位直接初始化为高置信度规则。
3. 支持规则降级：先匹配组织限定规则，再匹配岗位兜底规则。
4. 保留受保护分组机制，避免覆盖手工授权、测试、特殊账号。
5. 自动分组结果可解释：返回命中规则、命中条件、目标分组。
6. 一键初始化不再只生成岗位规则，而是生成“高置信度规则 + 冲突待确认”。

## 非目标

1. 不引入机器学习模型。
2. 不要求管理员穷尽所有岗位。
3. 不改变分组绑定套餐的同步机制，仍复用 `SyncUserBindGroupSubscriptions`。
4. 不让低置信度规则自动改用户分组。
5. 不改权限分组、订阅套餐本身的业务定义。

## 现有实现限制

当前模型：

```go
type GroupMappingRule struct {
    Id          int
    JobTitle    string `gorm:"uniqueIndex"`
    TargetGroup string
    Enabled     bool
    Priority    int
    Remark      string
}
```

限制：

1. `job_title` 唯一，不能存在：

```text
财务BP经理 + 华东大区财经管理部 -> 大区职能部门
财务BP经理 + 环渤海大区财经管理部 -> 城区级职能部门
财务BP经理 + 楼宇财经管理部 -> 集团职能部门
```

2. 只支持精确岗位匹配，不能表达包含、前缀、部门路径限定。
3. 不能解释为什么命中某个分组。
4. 初始化只能按岗位众数生成规则，容易把冲突岗位错误固化。

## 数据模型设计

保留表名 `group_mapping_rules`，升级字段。为减少破坏性迁移，可以保留 `job_title` 字段作为兼容字段，但新逻辑以多条件字段为准。

### `group_mapping_rules`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int | 主键 |
| `name` | varchar(128) | 规则名称 |
| `target_group` | varchar(64) | 目标分组 |
| `enabled` | bool | 是否启用 |
| `priority` | int | 优先级，数值越大越先匹配 |
| `confidence` | int | 置信度，0-100 |
| `auto_apply` | bool | 是否允许自动应用；低置信度规则只建议不应用 |
| `job_title_pattern` | varchar(255) | 岗位匹配值，可空 |
| `job_title_operator` | varchar(32) | `equals` / `contains` / `prefix` / `suffix` |
| `org_level1_pattern` | varchar(255) | 一级组织匹配，可空 |
| `org_level1_operator` | varchar(32) | 匹配方式 |
| `org_level2_pattern` | varchar(255) | 二级组织匹配，可空 |
| `org_level2_operator` | varchar(32) | 匹配方式 |
| `parent_department_pattern` | varchar(255) | 上级部门匹配，可空 |
| `parent_department_operator` | varchar(32) | 匹配方式 |
| `department_pattern` | varchar(255) | 所在部门匹配，可空 |
| `department_operator` | varchar(32) | 匹配方式 |
| `org_path_pattern` | text | 部门路径片段匹配，可空；不要求录完整路径 |
| `org_path_operator` | varchar(32) | 匹配方式，默认使用 `contains` |
| `remark` | varchar(256) | 备注 |
| `created_at` | bigint | 创建时间 |
| `updated_at` | bigint | 更新时间 |

### 匹配方式

首期只支持跨库、易解释的字符串匹配：

```text
equals    精确匹配
contains  包含
prefix    前缀
suffix    后缀
empty     字段为空
any       不限制
```

暂不支持正则，避免前端校验、数据库差异和误用风险。

### 路径维护策略

不做“完整部门路径精确匹配”。管理员不应该维护：

```text
华西区域事业部/华西区域事业部本部/区域运营/成都一城区/（成都一城区）半岛城邦三期管理处
```

而应该维护更稳定的片段或层级特征：

```text
岗位 = 财务BP经理
所在部门 contains 大区财经管理部
-> 大区职能部门

岗位 = 财务BP经理
所在部门 contains 环渤海大区财经管理部
-> 城区级职能部门

岗位 = 城区市场总监
-> 城区SC

岗位 contains 城区财务BP
-> 城区级职能部门
```

系统可以在预览和回放时展示完整路径，用来帮助管理员判断，但规则本身优先沉淀为：

```text
岗位关键词 + 一级组织/上级部门/所在部门关键词 + 少量路径片段
```

完整路径只作为兜底字段，不作为主要维护方式。

### 唯一性

取消 `job_title` 唯一约束。改为业务层避免完全重复规则：

```text
target_group + enabled + priority + 所有 match 条件完全相同
```

不要用数据库联合唯一索引强约束，因为 TEXT 字段在 MySQL/PostgreSQL/SQLite 上联合索引兼容性差。

## 匹配算法

输入用户上下文：

```go
type AutoGroupContext struct {
    CurrentGroup              string
    JobTitle                  string
    OrgLevel1Name             string
    OrgLevel2Name             string
    FeishuParentDepartmentName string
    FeishuDepartmentName       string
    OrgPath                   string
}
```

流程：

```text
1. 如果 current_group 在 protected_groups 中：跳过
2. 加载 enabled=true 的规则，按 priority desc, confidence desc, id asc 排序
3. 逐条判断：所有非空/非 any 条件都必须命中
4. 第一条命中的规则作为结果
5. 如果 auto_apply=true 且 confidence >= 90：自动改分组
6. 否则只返回建议，不自动改
```

### 降级逻辑

通过优先级表达降级，不写特殊代码：

```text
priority 1000：保护/特殊规则
priority 900：岗位 + 所在部门/上级部门关键词
priority 800：岗位 + 稳定路径片段
priority 700：岗位 + 一级组织/二级组织
priority 500：无争议岗位兜底
priority 100：低置信度建议规则
```

示例：

```text
规则 A：财务BP经理 + 所在部门包含 华东大区财经管理部 -> 大区职能部门，priority=900
规则 B：财务BP经理 + 所在部门包含 环渤海大区财经管理部 -> 城区级职能部门，priority=900
规则 C：财务BP经理 -> 大区职能部门，priority=100，auto_apply=false
```

这样同岗位先匹配组织特例，匹配不到再降级到岗位建议。

## 根据当前数据硬编码初始化的高置信度规则

这些规则可以在系统启动或“一键初始化默认规则”时生成。只在规则表为空或管理员点击初始化时插入，避免覆盖用户已有配置。

### 城区 SC

用户明确确认以下岗位都是 `城区SC`：

| 条件 | 目标分组 | 置信度 | 自动应用 |
|---|---|---:|---|
| 岗位 = 城区三保交付总监 | 城区SC | 100 | 是 |
| 岗位 = 城区解决方案总监 | 城区SC | 100 | 是 |
| 岗位 = 城区总经理 | 城区SC | 100 | 是 |
| 岗位 = 城区市场总监 | 城区SC | 100 | 是 |

### 城区级职能部门

用户明确确认：

| 条件 | 目标分组 | 置信度 | 自动应用 |
|---|---|---:|---|
| 岗位包含 城区财务BP | 城区级职能部门 | 100 | 是 |
| 岗位包含 城区人力行政共享 且 一级组织名称 = 人力资源中心 | 城区级职能部门 | 100 | 是 |
| 岗位 = 城区保洁专业经理 | 城区级职能部门 | 100 | 是 |

### 集团高层

来自当前数据，样本稳定：

| 条件 | 目标分组 | 置信度 | 自动应用 |
|---|---|---:|---|
| 岗位 = 董事长 | 集团高层 | 100 | 是 |
| 岗位 = 联席总裁 | 集团高层 | 100 | 是 |
| 岗位 = 首席财务官 | 集团高层 | 100 | 是 |

### 项目 BMG

当前数据稳定，且比“部门路径包含管理处”更安全：

| 条件 | 目标分组 | 置信度 | 自动应用 |
|---|---|---:|---|
| 岗位包含 物业项目 | 项目BMG | 100 | 是 |
| 岗位 = 项目经理（合资职位） | 项目BMG | 100 | 是 |

### itbp

高置信度规则：

| 条件 | 目标分组 | 置信度 | 自动应用 |
|---|---|---:|---|
| 一级组织名称 = 产品与解决方案中心 | itbp | 100 | 是 |
| 岗位包含 AIBP | itbp | 100 | 是 |
| 岗位包含 产品 且 一级组织名称 = 产品与解决方案中心 | itbp | 100 | 是 |
| 岗位包含 架构师 | itbp | 95 | 是 |
| 岗位包含 工程师 且 一级组织名称 in 产品与解决方案中心/深圳市一应科技有限公司/外部研发团队 | itbp | 90 | 是 |

注意：`深圳市一应科技有限公司` 本身不能直接全量归 `itbp`，当前样本只 4/11 是 itbp。

### 事业部 SC

当前数据稳定，但需要避免覆盖 `测试`、`agentone` 等保护分组：

| 条件 | 目标分组 | 置信度 | 自动应用 |
|---|---|---:|---|
| 岗位 = CEO | 事业部SC | 100 | 是 |
| 岗位 = COO | 事业部SC | 100 | 是 |
| 岗位 = CMO | 事业部SC | 100 | 是 |
| 岗位 = 大区CEO | 事业部SC | 100 | 是 |
| 岗位 = 大区COO | 事业部SC | 100 | 是 |
| 岗位 = 大区CMO | 事业部SC | 100 | 是 |

## 冲突岗位处理策略

以下岗位不应直接生成自动应用规则，除非配合组织限定：

```text
财务BP经理
事业部财务BP总监
市场中台经理
事业部人力行政部总监
管家经理（居住）
体系稽查经理
区域人事经理
区域客户总监
区域绩效薪酬经理
多经业务经理
经营管理经理
```

### 财务 BP 类降级示例

```text
岗位 = 财务BP经理
且 所在部门名称 contains 华东大区财经管理部/华南大区财经管理部/华西大区财经管理部/IFM财经管理部/增值服务财经管理部
-> 大区职能部门

岗位 = 财务BP经理
且 所在部门名称 contains 环渤海大区财经管理部
-> 城区级职能部门

岗位 = 财务BP经理
且 所在部门名称 contains 楼宇财经管理部
-> 集团职能部门

岗位 = 财务BP经理
-> 大区职能部门，auto_apply=false，只建议
```

### 三保/解决方案类

用户已确认：

```text
城区三保交付总监 -> 城区SC
城区解决方案总监 -> 城区SC
```

因此这两个岗位不再作为冲突岗位处理，直接生成自动应用规则。

## 保护分组建议

默认保护分组建议：

```text
agentone
测试
组织智能体专用
default
pending
集团高层
一级部门责任人
```

说明：

- `agentone`、`测试`、`组织智能体专用` 明显是特殊用途。
- `default`、`pending` 是否保护取决于业务：如果希望自动把 pending 用户转正，则不要保护 pending；如果希望人工确认，则保护 pending。
- `集团高层`、`一级部门责任人` 权限敏感，建议保护。

建议配置项仍使用现有 `auto_group.protected_groups`。

## API 设计

### 规则 CRUD

沿用现有路径，扩展字段：

```text
GET    /api/auto-group/rules
POST   /api/auto-group/rules
PUT    /api/auto-group/rules/:id
DELETE /api/auto-group/rules/:id
```

### 规则测试

升级测试接口，允许传完整上下文：

```http
POST /api/auto-group/resolve
```

请求：

```json
{
  "current_group": "pending",
  "job_title": "财务BP经理",
  "org_level1_name": "财经管理中心",
  "org_level2_name": "财经管理中心本部",
  "parent_department_name": "财经管理中心本部",
  "department_name": "华东大区财经管理部",
  "org_path": "财经管理中心/财经管理中心本部/华东大区财经管理部"
}
```

响应：

```json
{
  "matched": true,
  "target_group": "大区职能部门",
  "auto_apply": true,
  "confidence": 95,
  "rule_id": 12,
  "rule_name": "财务BP经理-华东大区财经",
  "reason": "岗位精确匹配，所在部门包含 华东大区财经管理部"
}
```

### 初始化默认规则

新增：

```http
POST /api/auto-group/rules/bootstrap-defaults
```

行为：

- 只插入系统内置高置信度规则。
- 不覆盖同名规则。
- 返回插入、跳过、冲突数量。

### 一键初始化预览

保留现有：

```text
POST /api/auto-group/initialize/preview
POST /api/auto-group/initialize/apply
```

但语义升级：

- `preview` 返回：高置信度建议、冲突岗位、低置信度建议。
- `apply` 默认只保存高置信度规则。

## 前端页面调整

自动分组页面建议改成 3 个区域：

1. **默认规则**
   - 按钮：初始化内置规则
   - 显示已初始化/未初始化状态

2. **规则管理**
   - 表格列：优先级、规则名、匹配条件、目标分组、置信度、自动应用、启用、操作
   - 新增/编辑规则弹窗支持多条件

3. **规则测试**
   - 不再只输入岗位。
   - 支持输入岗位 + 组织字段。
   - 支持从某个用户复制上下文测试。

## 迁移策略

1. AutoMigrate 增加新字段。
2. 保留旧 `job_title` 字段，旧数据迁移为：

```text
name = job_title
job_title_pattern = job_title
job_title_operator = equals
target_group = 原 target_group
confidence = 80
auto_apply = true
priority = 原 priority
```

3. 删除/放宽 `job_title` 唯一约束：
   - SQLite 不强制做 drop index，允许旧库保留但新逻辑不要再写重复 `job_title`。
   - MySQL/PostgreSQL 需要检测并删除旧唯一索引，或新增新表迁移更稳妥。

推荐更稳妥的迁移：

```text
新建 auto_group_rules 表
旧 group_mapping_rules 只读迁移一次
后续新逻辑使用 auto_group_rules
```

这样避免跨库删除唯一索引的复杂度。

## 推荐落地方案

采用新表：

```text
auto_group_rules
```

保留旧表：

```text
group_mapping_rules
```

兼容策略：

1. 优先使用 `auto_group_rules`。
2. 如果新表为空，再读取旧 `group_mapping_rules` 作为兼容。
3. 页面迁移到新规则模型。
4. 后续版本再考虑移除旧表。

## 测试计划

### 单元测试

1. 保护分组跳过。
2. 精确岗位命中。
3. 岗位包含命中。
4. 岗位 + 一级组织联合命中。
5. 岗位 + 所在部门联合命中。
6. 同岗位多规则按 priority 降级。
7. `auto_apply=false` 只建议不改分组。
8. 无规则不变更。
9. 空岗位、空组织字段不 panic。
10. 内置规则 bootstrap 幂等。

### 集成测试

1. OAuth 创建用户后拉取岗位和组织字段，命中规则自动分组。
2. 定时同步调岗后重新计算分组。
3. 自动分组后订阅同步仍触发。
4. 受保护分组用户不被覆盖。
5. 规则测试接口返回命中规则和 reason。

### 数据回放测试

使用 `users-2026-07-07.csv` 做离线回放：

- 统计自动命中人数。
- 统计待确认人数。
- 统计与现有分组不一致人数。
- 输出冲突岗位清单。

## 风险

1. 历史分组中可能有人工特殊授权，必须靠保护分组避免覆盖。
2. 同岗位冲突无法完全自动化，必须允许待确认。
3. 一些现有分组可能本身不一致，比如 `城区人力行政共享主管` 有 1 个大区职能部门例外，需要业务确认。
4. 内置规则基于当前样本，未来组织架构变化时需要回放验证。

## 结论

下一步应实现“新表 + 多条件规则 + 内置规则初始化”。

首批内置规则直接包含用户已确认的：

```text
城区三保交付总监 -> 城区SC
城区解决方案总监 -> 城区SC
城区总经理 -> 城区SC
城区市场总监 -> 城区SC
岗位包含 城区财务BP -> 城区级职能部门
岗位包含 城区人力行政共享 且 一级组织名称 = 人力资源中心 -> 城区级职能部门
城区保洁专业经理 -> 城区级职能部门
```

并补充当前数据中无争议的高置信度岗位。对于冲突岗位，必须通过组织路径/所在部门限定后才允许自动应用，否则只生成建议。
