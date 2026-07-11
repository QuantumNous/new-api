---
status: current
owner: Dev Team
last-reviewed: 2026-07-10
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
| Owner | 是 | 是 | 是 |
| Admin | 是 | 是 | 是 |
| Billing | 是 | 否 | 是 |
| Member | 只看本人 | 否 | 否 |
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

Name / ID | Owner ID | Status | Updated at | Manage
```

交互约定：

- 搜索同时覆盖组织名称、Owner 用户名、邮箱、显示名以及可解析的组织/Owner ID。
- 状态筛选提供 All、Active、Suspended。
- 创建弹窗只输入组织名称；成功后创建空组织，再到详情添加成员和指定 Owner。
- 不在创建弹窗中选择 Owner，避免把两个独立事务伪装成原子操作。
- 列表分页每页 20 条，搜索或状态变化时回到第一页。

## 管理员组织详情

页头展示组织名称、组织 ID、状态 Badge 和 Settings。

### Members Tab

```text
Members                         Active / Include removed  [Add member]

User | Role | Joined at | Status | Actions
```

- Add member 先搜索用户，再选择角色。
- 组织无 Owner 时，系统管理员的角色选项包含 Owner；已有 Owner 后隐藏该选项。
- Owner 使用只读 Badge，不能修改或移除。
- Include removed 展示历史成员和离开状态。
- 移除使用危险操作确认对话框；成功后刷新组织详情、成员和列表缓存。

### Billing Tab

```text
Start date | End date | User ID | Model | Channel ID | Refresh | Export

Requests | Amount | Raw Quota | Prompt tokens | Completion tokens | Active members

Usage trend | Member usage
Model usage | Channel usage
```

四个区块共用同一筛选参数。Refresh 同时刷新 summary、trend、members、models、channels；Export 复用相同参数。

维度表展示：

```text
Dimension | Amount | Raw Quota | Share | Requests
          | Prompt tokens | Completion tokens | Tokens | Pricing(模型表)
```

- Amount 使用站点 quota display 配置格式化。
- Raw Quota 保留内部事实值，便于审计。
- Share 为当前筛选窗口内维度 quota / summary quota；总额不大于 0 时显示 0%。
- Pricing 只显示当前 Tiered、Fixed price 或 Ratio 摘要，不暗示历史重算。

### Logs Tab

```text
Start date | End date | User ID | Model | Channel ID | Refresh | Export

Time | User | Model | Channel | Amount | Raw Quota | Tokens
```

日志使用服务端分页。当前表格不展示 `content`、request ID 和 upstream request ID，但当前 CSV 会包含这些字段，因此导出入口应视为高权限排障能力。

## 用户侧页面

### Organization billing

Owner/Admin/Billing 当前可见：

- 与管理员相同的日期、成员、模型、渠道筛选。
- 摘要指标。
- UTC 日趋势。
- 模型和渠道维度表。
- 导出按钮。

当前用户页没有成员排行表；成员维度只在管理员详情 Billing Tab 展示。

### Organization members

Owner/Admin 可进入：

- Settings：当前用户侧只编辑名称，状态选择只在系统管理员详情中显示。
- Add member：不能选择 Owner。
- Active / Include removed。
- Owner 只读；Owner 可以维护其他角色。
- 当前 UI 还限制 Admin 修改或移除其他 Admin，比后端权限更严格。

### Organization logs

Owner/Admin/Billing 可进入，筛选、分页和导出与管理员 Logs Tab 一致，但组织 ID 由当前登录用户推导。

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
- 用户 ID、模型、渠道使用直接输入；后续替换选择器时不能改变服务端参数语义。

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

### Member 用量页

后端已经把 Member 的账单查询强制限制为本人；侧边栏也会为 Member 显示 Billing 链接。但前端页面的 `canViewBilling` 只接受 Owner/Admin/Billing，Member 进入后会看到 No permission。

正确收敛方式：允许 Member 打开 Billing，隐藏成员筛选和导出组织全量的能力，服务端继续强制 `user_id` 为当前用户。不能通过把 Member 加入完整账单角色集合来修复。

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
