---
status: draft
owner: Dev Team
last-reviewed: 2026-07-08
---

# 组织管理与组织账单 UI 设计

## 设计结论

第一版 UI 采用“简洁后台工作台”设计，不做营销式页面，也不做复杂组织财务中台。

页面目标只有三件事：

1. 管理员可以把用户加入组织。
2. 组织 Owner/Admin 可以管理本组织成员和角色。
3. 组织 Owner/Admin/Billing 可以查看组织账单，普通 Member 只能看自己的组织内用量。

组织仍然只是“成员集合 + 报表权限 + 汇总视图”，不是付款主体。UI 不展示组织余额、组织充值、组织订阅、组织 API Key、项目成本中心、Header 归属或 Token 归属。

## 设计约束

### 产品边界

- 不把 `group` 呈现为组织。
- 不允许用户在请求时选择组织。
- 不在 API Key 页面增加组织绑定。
- 不在钱包、订阅、充值页面增加组织付款入口。
- 组织账单只解释已经发生的个人消费日志。
- 离开组织的成员仍保留历史账单归属口径。

### 前端边界

- 使用 `web/default` 现有 React 19、TanStack Router、React Query、Base UI、Tailwind、i18next 体系。
- 页面使用现有 `SectionPageLayout`、`DataTablePage`、`StaticDataTable`、`Dialog`、`ConfirmDialog`、`Tabs`、`Button`、`Input`、`Select` 等组件。
- 用户可见文本全部通过 `useTranslation()` + `t('...')`。
- 不引入新的设计系统。
- 不做嵌套卡片。
- 页面密度保持后台工具风格，优先表格、筛选、汇总条和紧凑操作区。

## 信息架构

### 用户侧入口

新增组织模块，建议放在侧边栏“Console”或“Personal”之间，命名为：

- `Organization`

模块下三个页面：

- `/organization/usage`
- `/organization/members`
- `/organization/logs`

不单独做 `/organization/settings` 第一版页面。组织名称编辑放在成员页面右上角的轻量设置弹窗中，减少入口数量。

入口可见性：

- 未加入组织：不显示组织模块。
- Member：显示 `Usage`，只展示自己的组织内用量；不显示成员管理入口，`Logs` 只显示自己的明细或不显示。
- Billing：显示 `Usage` 和 `Logs`。
- Owner/Admin：显示 `Usage`、`Members`、`Logs`。

### 管理员侧入口

新增管理员页面：

- `/admin/organizations`

组织详情不单独开新页面，第一版使用同页右侧 Drawer 或详情页内嵌 Tabs。推荐路由仍保留：

- `/admin/organizations/:id`

但第一版可以由列表行点击进入详情页，详情页包含：

- `Overview`
- `Members`
- `Billing`
- `Logs`

这样管理员能完成组织创建、成员维护和组织账单排查。

## 页面一：把用户添加到组织

### 管理员组织列表页

路由：

- `/admin/organizations`

页面结构：

```text
Organizations
  [Create organization]

Toolbar:
  Search organization / owner
  Status filter

Table:
  Name | Owner | Status | Active members | Total quota | Updated at | Actions
```

主操作：

- `Create organization`
- 行操作：`View details`

创建组织弹窗：

```text
Organization name
Owner user

[Cancel] [Create]
```

Owner 选择器：

- 使用搜索输入。
- 远程调用现有用户搜索接口。
- 显示 `username / email / display_name`。
- 只允许选择启用用户。

错误处理：

- Owner 已属于其他组织：在表单下方提示 `This user already belongs to an organization.`
- 用户不存在或已禁用：提示 `Select an active user.`

### 管理员添加成员

在组织详情 `Members` Tab 中提供主按钮：

- `Add member`

弹窗字段：

```text
User
Role

[Cancel] [Add member]
```

Role 选项：

- `Member`
- `Billing`
- `Admin`

不允许通过这个弹窗添加 `Owner`。Owner 是组织创建时确定的角色。

添加成功后：

- 关闭弹窗。
- 刷新成员列表。
- 刷新组织列表的 active member count。
- Toast：`Member added.`

添加失败后：

- 用户已在其他组织：展示服务端错误。
- 无权限：展示统一错误提示。

## 页面二：组织管理与成员角色

### 用户侧成员页面

路由：

- `/organization/members`

仅 Owner/Admin 可访问。

页面结构：

```text
Organization members
  [Organization settings] [Add member]

Summary strip:
  Organization name | Active members | Owner | Status

Table:
  User | Email | Role | Joined at | Status | Actions
```

角色展示：

- Owner：不可编辑，使用只读 badge。
- Admin：可管理成员和组织基础信息。
- Billing：可看账单和导出，不能管理成员。
- Member：默认只看自己的组织内用量。

行操作：

- `Change role`
- `Remove member`

限制：

- Owner 不可移除。
- Owner 不可被降级。
- 当前用户不能移除自己，避免组织无人管理。
- 移除成员必须二次确认。

移除确认文案：

```text
Remove member?
This keeps historical usage in organization billing for the time this user belonged to the organization.
```

### 组织设置弹窗

第一版只提供基础信息：

```text
Organization name
Status

[Cancel] [Save]
```

不放余额、订阅、付款客户 ID 或发票信息。

### 管理员组织详情页

路由：

- `/admin/organizations/:id`

页面结构：

```text
Organization detail
  [Edit organization] [Add member]

Tabs:
  Overview | Members | Billing | Logs
```

管理员详情页的 `Members` Tab 与用户侧成员页基本复用同一套组件，只是接口换成 `/api/admin/organizations/:id/members`。

## 页面三：组织账单界面

### 用户侧用量页

路由：

- `/organization/usage`

页面结构：

```text
Organization usage

Date range | Member filter | Model filter | Channel filter

Metric strip:
  Total quota | Requests | Prompt tokens | Completion tokens | Active members

Trend

Two-column section:
  Model usage table
  Channel usage table

Member ranking table
```

视觉原则：

- 不使用大面积图形装饰。
- 指标条是紧凑横向信息块，不做大卡片堆叠。
- 趋势图占一行，模型/渠道分布用表格优先，必要时再补小型条形图。
- Member 用户看到同一路由，但筛选被锁定为自己，成员排行隐藏。

筛选：

- `Date range`：默认最近 30 天。
- `Member`：Owner/Admin/Billing 可选；Member 不显示。
- `Model`：可输入或选择。
- `Channel`：可选择。
- `Log type`：默认 Consume；对账模式下显示 Consume/Refund/System。

### 用户侧消费明细页

路由：

- `/organization/logs`

页面结构：

```text
Organization logs
  [Export CSV]

Filters:
  Date range | Member | Model | Channel | Log type | Request ID

Table:
  Time | Member | Model | Quota | Tokens | Channel | Type | Request ID | Details
```

导出规则：

- Owner/Admin/Billing 可导出组织范围。
- Member 只能导出自己的组织内明细，如果开放该页面。
- 导出按钮直接调用 `/api/organization/current/billing/logs/export`。
- 导出沿用当前筛选条件。

明细抽屉：

- 展示 `content`、`request_id`、`upstream_request_id`、`token_name`、`other` 中非 admin-only 字段。
- 不展示 `admin_info`。

### 管理员账单视图

管理员组织详情 `Billing` Tab：

```text
Billing

Date range | Member | Model | Channel | View mode

Metric strip
Trend
Member ranking
Model usage
Channel usage
```

管理员组织详情 `Logs` Tab：

```text
Logs
  [Export CSV]

Filters
Table
```

管理员调用 `/api/admin/organizations/:id/billing/*`。

## 组件拆分

新增 feature：

```text
web/default/src/features/organizations/
  api.ts
  types.ts
  constants.ts
  index.tsx
  components/
    organization-summary-strip.tsx
    organization-members-table.tsx
    organization-member-dialog.tsx
    organization-role-select.tsx
    organization-settings-dialog.tsx
    organization-billing-filters.tsx
    organization-billing-metrics.tsx
    organization-usage-trend.tsx
    organization-usage-table.tsx
    organization-logs-table.tsx
    organization-log-detail-dialog.tsx
    admin-organizations-table.tsx
```

路由文件：

```text
web/default/src/routes/_authenticated/organization/usage.tsx
web/default/src/routes/_authenticated/organization/members.tsx
web/default/src/routes/_authenticated/organization/logs.tsx
web/default/src/routes/_authenticated/admin/organizations/index.tsx
web/default/src/routes/_authenticated/admin/organizations/$id.tsx
```

如果当前路由树不适合 `admin` 子目录，也可以沿用现有管理员顶级页面模式，但 URL 仍建议保持 `/admin/organizations`。

## API 对接

用户侧：

- `GET /api/organization/self`
- `GET /api/organization/current`
- `PATCH /api/organization/current`
- `GET /api/organization/current/members`
- `POST /api/organization/current/members`
- `PATCH /api/organization/current/members/:user_id`
- `DELETE /api/organization/current/members/:user_id`
- `GET /api/organization/current/billing/summary`
- `GET /api/organization/current/billing/members`
- `GET /api/organization/current/billing/models`
- `GET /api/organization/current/billing/channels`
- `GET /api/organization/current/billing/trend`
- `GET /api/organization/current/billing/logs`
- `GET /api/organization/current/billing/logs/export`

管理员侧：

- `GET /api/admin/organizations`
- `POST /api/admin/organizations`
- `GET /api/admin/organizations/:id`
- `PATCH /api/admin/organizations/:id`
- `GET /api/admin/organizations/:id/members`
- `POST /api/admin/organizations/:id/members`
- `PATCH /api/admin/organizations/:id/members/:user_id`
- `DELETE /api/admin/organizations/:id/members/:user_id`
- `GET /api/admin/organizations/:id/billing/*`
- `GET /api/admin/organizations/:id/billing/logs/export`

React Query key 约定：

```ts
['organization', 'self']
['organization', 'current']
['organization', 'members', organizationId]
['organization', 'billing', 'summary', filters]
['organization', 'billing', 'members', filters]
['organization', 'billing', 'models', filters]
['organization', 'billing', 'channels', filters]
['organization', 'billing', 'trend', filters]
['organization', 'billing', 'logs', filters, page]
['admin', 'organizations', filters, page]
['admin', 'organization', organizationId]
```

成员变更后 invalidate：

- `['organization', 'self']`
- `['organization', 'members']`
- `['organization', 'billing']`
- `['admin', 'organizations']`
- `['admin', 'organization', organizationId]`

## 权限与空状态

### 未加入组织

普通用户不展示侧边栏组织入口。

如果用户直接访问组织路由，显示 404 或空状态：

```text
You are not in an organization.
```

不提供“创建组织”按钮。组织创建由管理员完成。

### Member

- `/organization/usage` 可访问。
- 指标只显示当前用户在组织成员有效期内的用量。
- 不展示成员排行。
- 不展示组织成员列表。
- 不展示导出组织全量明细。

### Billing

- 可查看组织汇总、成员排行、模型、渠道、趋势、明细。
- 可导出。
- 不能添加、移除、修改成员。

### Owner/Admin

- 可管理组织基础信息。
- 可添加成员。
- 可调整角色。
- 可移除非 Owner 成员。
- 可查看和导出账单。

## 简洁交互细节

### 添加成员

交互路径：

```text
Members page -> Add member -> search user -> select role -> submit
```

不要做邀请流、邮箱邀请、批量导入、部门树。

### 角色修改

行内 `Role` 使用 Select，不打开复杂编辑页。

提交策略：

- 选择新角色后即时保存。
- 保存中禁用该行操作。
- 保存失败回滚到旧角色。

### 移除成员

只提供二次确认弹窗。

移除后列表中默认消失；如果打开 `Show history`，显示为 `Left` 状态。

### 账单筛选

筛选条固定在表格上方，不做高级搜索抽屉。

筛选变更后：

- 自动更新 URL search params。
- React Query 重新拉取数据。
- 导出按钮复用相同 query params。

## 响应式

桌面：

- 组织账单指标条一行 5 个指标。
- 趋势图全宽。
- 模型/渠道表格两列并排。
- 成员和日志使用 DataTable。

移动：

- 指标条变成两列。
- 模型/渠道表格上下排列。
- 日志表格使用现有 `MobileCardList` 或 `DataTablePage` 移动卡片模式。
- 筛选项折叠为两行，不放入全屏抽屉。

## i18n Key 建议

新增静态 key：

```text
Organization
Organizations
Organization usage
Organization members
Organization logs
Create organization
Add member
Edit organization
Organization settings
Owner
Admin
Billing
Member
Active members
Total quota
Prompt tokens
Completion tokens
Model usage
Channel usage
Member ranking
Export CSV
Remove member?
Member added.
Member removed.
Role updated.
You are not in an organization.
This user already belongs to an organization.
This keeps historical usage in organization billing for the time this user belonged to the organization.
```

所有 locale 文件都需要补齐：`en`、`zh`、`fr`、`ja`、`ru`、`vi`。

## 第一版不做

- 不做组织自助创建。
- 不做邀请链接。
- 不做批量添加成员。
- 不做部门、团队、项目、成本中心。
- 不做组织 API Key。
- 不做组织钱包、组织订阅、组织充值。
- 不做发票、付款客户 ID。
- 不做跨组织切换器，因为一个用户同一时间只能属于一个组织。
- 不做图表大屏。

## 验收标准

1. 管理员能创建组织并选择 Owner。
2. 管理员能将未加入组织的用户加入指定组织。
3. Owner/Admin 能在用户侧成员页添加、移除成员并修改角色。
4. Billing 能看到组织账单，但看不到成员管理操作。
5. Member 只能看到自己的组织内用量。
6. 组织账单页面能展示总览、趋势、成员排行、模型分布、渠道分布和明细。
7. 组织明细导出复用当前筛选条件。
8. 未加入组织的用户不显示组织入口。
9. UI 不出现组织余额、组织充值、组织订阅、Token 归属或项目成本中心。
10. 所有新增可见文本都走 i18n。

## 实施顺序

1. 新增 `features/organizations` 的类型和 API 封装。
2. 增加 `/organization/usage`，先完成用户侧账单只读视图。
3. 增加 `/organization/members`，完成 Owner/Admin 成员管理。
4. 增加 `/organization/logs`，完成组织明细和导出。
5. 增加 `/admin/organizations` 和 `/admin/organizations/:id`。
6. 接入侧边栏权限可见性。
7. 补齐 i18n。
8. 跑 `bun run typecheck`、相关 lint 和构建检查。
