---
status: current
owner: Dev Team
last-reviewed: 2026-07-15
---

# 组织管理与组织账单 UI 设计

## 文档边界

本文只定义界面信息架构、页面状态、交互和呈现，不重复定义组织数据、权限或账单算法。组织领域设计以 [组织与组织账单架构设计](../20-architecture/组织与组织账单架构设计.md) 为准。

界面采用简洁后台工作台风格：表格、紧凑筛选、摘要指标和明确操作优先，不把组织页做成营销页或复杂财务中台。

## 设计基础

当前默认前端使用：

- React 19、TanStack Router、React Query。
- Base UI/shadcn `base-nova` 组合，CSS Variables 与 Tailwind CSS。
- Hugeicons 图标。
- `@/components/ui` 中现有 Button、Input、NativeSelect、Table、Badge、Dialog、Empty 等组件。
- i18next；所有用户可见文本使用 `useTranslation()` 和 `t()`。

组织 feature 当前由 `api.ts`、`types.ts` 和 `index.tsx` 组成，路由文件保持薄层。后续拆组件应按稳定页面概念进行，不为缩短文件机械拆分单次使用函数。

## 信息架构

### 用户侧

侧边栏只有在 `/api/organization/self` 返回当前组织时才显示组织分组：

```text
Organization billing  -> /organization/usage
Organization members  -> /organization/members
Organization logs     -> /organization/logs
```

目标可见性：

| 角色 | Billing | Members | Logs |
|---|---:|---:|---:|
| Admin | 是 | 是 | 是 |
| Member | 只看本人 | 否 | 只看本人 |
| 未加入组织 | 不显示入口 | 不显示入口 | 不显示入口 |

### 管理员侧

```text
/admin/organizations       组织列表
/admin/organizations/:id   组织详情
```

组织详情保持三个一级 Tab：

```text
Members | Billing | Logs
```

不增加独立 Overview 或 Settings 页面。名称和状态在设置弹窗中编辑，减少导航层级。

## 管理员组织列表

页面结构：

```text
Organizations                                  [Create organization]
Search organizations | Status                 [Refresh]

Name / ID | Status | Updated at | Manage
```

交互约定：

- 搜索覆盖组织名称和可解析的组织 ID。
- 状态筛选提供 All、Active、Suspended。
- 创建弹窗只输入组织名称；成功后创建空组织，再到详情添加 Admin 或 Member。
- 列表分页每页 20 条，搜索或状态变化时回到第一页。

## 管理员组织详情

页头展示组织名称、组织 ID、状态 Badge 和 Settings。

### Members Tab

```text
Members                         Active / Include removed  [Add member]

User | Role | Joined at | Status | Actions
```

- Add member 先搜索用户，再选择角色。
- 角色选项固定为 Admin、Member。
- Include removed 展示历史成员和离开状态。
- 移除使用危险操作确认对话框；成功后刷新组织详情、成员和列表缓存。

### Billing Tab

```text
Start date | End date | User | Model | Channel | Refresh | Export

Requests | Consumption amount | Raw Quota | Prompt tokens | Completion tokens | Active members

Usage trend | Member usage
Model usage | Channel usage
```

四个区块共用同一筛选参数。Refresh 同时刷新 summary、trend、members、models、channels；Export 复用相同参数。

维度表展示：

```text
Dimension | Consumption amount | Raw Quota | Share | Requests
          | Prompt tokens | Completion tokens | Tokens | Current pricing(模型表)
```

- Consumption amount 是用户首要关注字段，用户、模型、渠道都必须展示；它由历史 `total_quota` 换算，不重新计费。
- USD、CNY 和自定义货币沿用站点显示配置；TOKENS 模式仍显示 USD 等值，不能让 Consumption amount 与 Raw Quota 重复。
- Raw Quota 保留内部事实值，便于审计。
- Share 为当前筛选窗口内维度 quota / summary quota；总额不大于 0 时显示 0%。
- Current pricing 只显示当前 Tiered、Fixed price 或 Ratio 摘要；固定价格使用货币格式，不暗示历史重算。

### Logs Tab

```text
Start date | End date | User | Model | Channel | Refresh | Export

Time | User | Model | Channel | Consumption amount | Raw Quota | Tokens
```

日志使用服务端分页。Logs 页的 Export 保留既有 `billing/logs/export` 单表 CSV；当前表格不展示 `content`、request ID 和 upstream request ID，但该兼容 CSV 会包含这些字段，因此导出入口应视为高权限排障能力。

Billing 页的 Export 使用新增 `billing/export`。完整 CSV 的汇总、用户、模型、渠道、趋势和明细区块均按“消费金额、币种、原始 quota”顺序提供金额信息；消费金额为不带货币符号的 6 位小数，确保可直接在表格软件中求和。模型区块额外提供当前计价规则。

## 用户侧页面

### Organization billing

Admin 可查看组织完整范围，Member 只查看本人范围：

- 与管理员相同的日期、成员、模型、渠道筛选。
- 摘要指标。
- UTC 日趋势。
- 模型和渠道维度表。
- 导出按钮。

当前用户页没有成员排行表；成员维度只在管理员详情 Billing Tab 展示。

### Organization members

Admin 可进入：

- Settings：当前用户侧只编辑名称，状态选择只在系统管理员详情中显示。
- Add member：只可选择 Admin、Member。
- Active / Include removed。
- Admin 可以维护其他成员的角色。

### Organization logs

Admin 和 Member 都可进入，筛选、分页和导出与管理员 Logs Tab 一致，但组织 ID 由当前登录用户推导；Member 的服务端范围强制为本人。

### 空状态与拒绝状态

- 当前组织查询加载中：边框内 Loading 区块。
- 未加入组织：No organization 空状态，并提示联系管理员添加。
- 角色不允许：No permission 空状态，不渲染敏感数据查询结果。
- 无表格数据：使用统一 No data 行，不保留空白区域。

## 筛选与时间

- 日期输入按 UTC 日边界转换：开始日 00:00:00，结束日 23:59:59。
- 当前默认日期为空，表示不额外限制账期；旧草案中的“默认最近 30 天”尚未实现。
- 当前筛选保存在页面本地状态，没有同步到 URL search params。
- 修改任一筛选会把日志页码重置为 1。
- User、Model、Channel 使用下拉选择；界面显示用户名、模型名、渠道名，提交查询时分别保留 `user_id`、`model_name`、`channel` 参数合同。
- 下拉选项从当前用户可见的组织账单维度加载，系统管理员使用目标组织范围，普通 Member 不显示成员筛选。

## 响应式与可访问性

- 筛选区从单列开始，在 `sm` 变为两列，在大屏变为多列加操作区。
- 摘要指标从两列扩展到大屏六列。
- Billing 维度区在 `xl` 使用两列；窄屏纵向排列。
- 表格容器允许横向滚动，不在移动端截断审计字段。
- 图标按钮必须带 `sr-only` 文本或 `aria-label`。
- Dialog 需要标题、说明、可见提交状态和合理焦点顺序。
- 角色和状态不能只用颜色表达，必须同时显示文字。
- 键盘 focus、loading、disabled、empty 和 error 是功能状态，不得因视觉改版删除。

## 当前实现与产品目标的差异

### 状态语义

UI 把 disabled 显示为 Suspended，但后端当前没有阻断组织访问或个人 API 使用。界面文案不得暗示它已经冻结消费；如要实现强制停用，必须先完成后端语义设计。

### 导出敏感字段

页面日志表是收敛展示，CSV 却包含内容和内部请求标识。客户版导出需要独立脱敏列清单和文案，不应仅把当前按钮改名为“账单下载”。

### 请求状态

当前组织页面对 loading 和 empty 有专门状态，但错误主要依赖全局处理。后续重构应补充区块级 retry/错误说明，同时保留 React Query 的缓存和失效语义。

## 第一版明确不展示

- 组织余额、充值、订阅、付款客户和发票。
- 组织 API Key、Token 绑定和请求组织选择器。
- 部门树、项目、成本中心、邀请链接和批量导入。
- 历史价格重算结果。
- 大屏图表或装饰性数据可视化。

这些内容属于产品和领域边界，不得通过 UI 先行引入。
