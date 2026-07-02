# 订阅管理与时间额度套餐 — 实施计划

## 需求概述

1. 新增时间额度套餐类型：5小时、每周、每月（固定30天）
2. 首次使用激活计时（非购买时开始）
3. 每月套餐30天激活窗口，超期未激活自动作废
4. 个人中心新增「订阅管理」菜单，从钱包管理拆分出来
5. 用户可拖拽调整套餐优先级、临时禁用套餐
6. UI 显示时间进度条（时间套餐）和额度进度条（额度套餐）

---

## 一、数据模型变更

### 1.1 `SubscriptionPlan` 新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ActivationMode` | `string` | `"immediate"` | `"immediate"`=购买即生效（现有行为），`"on_first_use"`=首次使用时激活（新时间套餐） |
| `ActivationWindowSeconds` | `int64` | `0` | 未激活自动过期秒数。月套餐=2592000（30天），周套餐=604800（7天），5小时=86400（24小时） |

### 1.2 `UserSubscription` 新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `Priority` | `int` | `0` | 用户自定义优先级，数值越高越优先消耗 |
| `Disabled` | `bool` | `false` | 用户临时禁用该套餐 |
| `ActivatedAt` | `int64` | `0` | 首次使用时间戳，0=未激活 |

新增状态值：`"pending_activation"` — 已购买但尚未激活

### 1.3 建表/迁移

GORM AutoMigrate 自动添加列。跨数据库兼容（SQLite/MySQL/PostgreSQL），无需手写 DDL。

---

## 二、后端逻辑变更

### 2.1 订阅创建 (`CreateUserSubscriptionFromPlanTx`)

当 `plan.ActivationMode == "on_first_use"` 时：

```
Status       = "pending_activation"
EndTime      = 0          // 激活后计算
ActivatedAt  = 0
// 不触发 applyResolvedUserGroup（未激活不改变用户分组）
```

### 2.2 首次使用激活

在 `PreConsumeUserSubscription` 中遍历候选订阅时：

- 若 `status == "pending_activation"` 且 `now < CreatedAt + plan.ActivationWindowSeconds`：
  - 激活：`Status = "active"`，`ActivatedAt = now`，`EndTime = now + plan duration`
  - 若 `plan.UpgradeGroup != ""`，触发 `applyResolvedUserGroup`
  - 然后正常执行预消费逻辑

- 若 `status == "pending_activation"` 且超出激活窗口：
  - 标记为 `"expired"`，跳过该订阅

### 2.3 消费优先级 (`PreConsumeUserSubscription`)

修改查询过滤和排序：

```sql
WHERE user_id = ?
  AND status = 'active'
  AND disabled = false
  AND end_time > ?
ORDER BY priority DESC, end_time ASC, id ASC
FOR UPDATE
```

规则：
- 跳过 `disabled = true` 的订阅
- 优先级高的先消耗（`priority DESC`）
- 同优先级按到期时间近的先消耗（`end_time ASC`）
- 同到期时间按 ID 升序（`id ASC`）

### 2.4 用户组解析 (`resolveUserGroupBySubscriptions`)

跳过 `disabled = true` 和 `status != 'active'` 的订阅。

### 2.5 定时任务

#### `ExpireDueSubscriptions` 增加逻辑

扫描待激活订阅是否超出激活窗口（需要 JOIN `subscription_plans` 获取 `activation_window_seconds`）：

```sql
SELECT us.* FROM user_subscriptions us
JOIN subscription_plans sp ON sp.id = us.plan_id
WHERE us.status = 'pending_activation'
  AND us.created_at + sp.activation_window_seconds < ?
```

将其标记为 `expired`。

#### `ResetDueSubscriptions`
无需改动。

### 2.6 新增 API

| 方法 | 路径 | 功能 | Auth |
|------|------|------|------|
| `PUT` | `/api/subscription/self/priority` | 更新订阅优先级 | User |
| `POST` | `/api/subscription/self/toggle/:id` | 启用/禁用某订阅 | User |

#### 优先级请求体

```json
{ "subscription_ids": [3, 1, 2] }
```

按优先级从高到低排列，后端依次分配 `priority = len-1, len-2, ..., 0`。

#### Toggle 请求体

```json
{ "disabled": true }
```

或 `{ "disabled": false }` 恢复。

### 2.7 修改 `GetSubscriptionSelf` 返回

增强返回结构，加入进度信息和计划详情：

```json
{
  "billing_preference": "subscription_first",
  "subscriptions": [
    {
      "subscription": {
        "id": 1,
        "plan_id": 5,
        "amount_total": 100000,
        "amount_used": 50000,
        "start_time": 1700000000,
        "end_time": 1702592000,
        "status": "active",
        "priority": 2,
        "disabled": false,
        "activated_at": 1700000000
      },
      "plan": {
        "id": 5,
        "title": "月套餐",
        "duration_unit": "month",
        "duration_value": 1,
        "activation_mode": "on_first_use",
        "total_amount": 100000,
        "quota_reset_period": "never"
      },
      "progress": {
        "time_elapsed_seconds": 3600,
        "time_total_seconds": 2592000,
        "time_remaining_seconds": 2588400,
        "time_percent": 0.14,
        "quota_used": 50000,
        "quota_total": 100000,
        "quota_percent": 50.0
      }
    }
  ],
  "all_subscriptions": [...]
}
```

---

## 三、前端变更

### 3.1 菜单拆分

#### `web/src/components/layout/SiderBar.jsx` — `financeItems` 新增

```jsx
{
  text: t('订阅管理'),
  itemKey: 'subscription-self',
  to: '/console/subscription-self',
}
```

#### `web/src/hooks/common/useSidebar.js` — `DEFAULT_ADMIN_CONFIG.personal` 新增

```js
'subscription-self': true,
```

#### `routerMap` 新增映射

```js
'subscription-self': '/console/subscription-self',
```

### 3.2 路由 (`web/src/App.jsx`)

```jsx
const SubscriptionSelf = lazy(() => import('./pages/SubscriptionSelf'));

<Route path='/console/subscription-self' element={
  <PrivateRoute>
    <Suspense fallback={<Loading />}>
      <SubscriptionSelf />
    </Suspense>
  </PrivateRoute>
} />
```

### 3.3 新建文件结构

```
web/src/pages/SubscriptionSelf/index.js              # 入口文件
web/src/components/subscriptions/
  SubscriptionManagement.jsx                          # 主组件
  SubscriptionCard.jsx                                # 单个套餐卡片
  SubscriptionProgressBar.jsx                         # 进度条组件（时间/额度通用）
```

### 3.4 订阅管理页功能设计

#### 卡片列表

每张 `SubscriptionCard` 显示：

- **标题行**：计划标题 + 类型标签（「时间套餐」/「额度套餐」）+ 状态标签（active/pending/disabled/expired）
- **时间进度条**（仅时间套餐）：
  - 显示「已用 X小时 / 剩余 X小时」
  - 进度条颜色根据剩余时间变化（绿色→黄色→红色）
  - 剩余时间倒计时实时更新（`setInterval` 每秒刷新）
- **额度进度条**：
  - 显示「已用 X / 总额 Y」
  - 进度条颜色根据使用比例变化
- **右侧操作区**：
  - Switch toggle：启用/禁用
  - 拖拽手柄（左侧）：长按拖动调整优先级

#### 拖拽排序

- 使用 `@dnd-kit/sortable`（项目已安装 `@dnd-kit/core: 6.1.0`, `@dnd-kit/sortable: 8.0.0`）
- 实现垂直列表拖拽排序
- 松开后调用 `PUT /api/subscription/self/priority` 持久化顺序

#### 计费偏好

从钱包页移入此页：

```jsx
<Select
  value={billingPreference}
  onChange={handleChangePreference}
  optionList={[
    { value: 'subscription_first', label: t('优先订阅') },
    { value: 'wallet_first', label: t('优先钱包') },
    { value: 'subscription_only', label: t('仅用订阅') },
    { value: 'wallet_only', label: t('仅用钱包') },
  ]}
/>
```

### 3.5 钱包页简化

`web/src/components/topup/index.jsx`：
- 移除：订阅状态展示区域、计费偏好选择器
- 保留：钱包余额、充值方式、兑换码、购买新套餐入口
- 订阅购买入口可保留或改为跳转链接到订阅管理页

### 3.6 翻译新增

`web/src/i18n/locales/zh-CN/billing.json` 新增 key（同步到 en/ja/fr/ru/vi）：

```
"订阅管理"
"时间套餐"
"额度套餐"
"剩余"
"已用"
"待激活"
"已禁用"
"已过期"
"拖拽调整优先级"
"临时禁用"
"套餐优先级"
"5小时"
"每周"
"每月"
"激活窗口"
"时间进度"
"额度进度"
"尚未使用"
```

---

## 四、边界情况

| 场景 | 处理方式 |
|------|----------|
| 时间套餐到期发生在请求中 | `end_time > now` 预消费前过滤，到期跳过 |
| 所有套餐被用户禁用 | 回退到钱包消耗（根据 `billing_preference`） |
| 待激活套餐超出激活窗口 | `ExpireDueSubscriptions` 定时任务标记 expired |
| 用户所有活动订阅都被 cancel/expire | `applyResolvedUserGroup` 回退到 `base_level` |
| 同一计划多次购买 | 已有 `MaxPurchasePerUser` 限制，无需改动 |
| 拖拽排序后刷新页面 | 优先级已持久化，后端返回时按 priority DESC 排序 |

---

## 五、实施顺序

| 序号 | 步骤 | 涉及文件 |
|------|------|----------|
| 1 | Backend model 新增字段 | `model/subscription.go` |
| 2 | Backend `PreConsumeUserSubscription` 逻辑 | `model/subscription.go` |
| 3 | Backend 激活逻辑 + 消费优先级 | `model/subscription.go` |
| 4 | Backend `ExpireDueSubscriptions` + `resolveUserGroupBySubscriptions` | `model/subscription.go` |
| 5 | Backend API 控制器 | `controller/subscription.go` |
| 6 | Backend 路由注册 | `router/api-router.go` |
| 7 | Frontend 菜单 + 路由 | `useSidebar.js`, `SiderBar.jsx`, `App.jsx` |
| 8 | Frontend 订阅管理页面组件 | `web/src/components/subscriptions/*` |
| 9 | Frontend 拖拽 + 禁用 + 进度条 | 同上 |
| 10 | Frontend 钱包页简化 | `web/src/components/topup/index.jsx` |
| 11 | 翻译文件 | `web/src/i18n/locales/*/billing.json` |
| 12 | 验证测试 | 全流程测试 |

---

## 六、关键代码位置速查

| 模块 | 文件路径 | 关键函数 |
|------|----------|----------|
| UserSubscription 模型 | `model/subscription.go:323` | struct |
| SubscriptionPlan 模型 | `model/subscription.go:189` | struct |
| 订阅创建 | `model/subscription.go:507` | `CreateUserSubscriptionFromPlanTx` |
| 预消费 | `model/subscription.go:1148` | `PreConsumeUserSubscription` |
| 到期检查 | `model/subscription.go:1032` | `ExpireDueSubscriptions` |
| 用户组解析 | `model/subscription.go:714` | `resolveUserGroupBySubscriptions` |
| 控制器 | `controller/subscription.go` | `GetSubscriptionSelf` 等 |
| 路由 | `router/api-router.go:174` | subscription routes |
| 消费源 | `service/funding_source.go:70` | `SubscriptionFunding` |
| 账单会话 | `service/billing_session.go:343` | `NewBillingSession` |
| 前端钱包页 | `web/src/components/topup/index.jsx` | 主组件 |
| 前端套餐卡 | `web/src/components/topup/SubscriptionPlansCard.jsx` | 用户订阅展示 |
| 前端菜单 | `web/src/components/layout/SiderBar.jsx:132` | `financeItems` |
| 前端菜单配置 | `web/src/hooks/common/useSidebar.js:28` | `DEFAULT_ADMIN_CONFIG` |
| 前端路由 | `web/src/App.jsx` | Route 定义 |
| 前端格式化 | `web/src/helpers/subscriptionFormat.js` | 持续/重置周期格式化 |

---

## 七、评审问题修正记录

| # | 问题 | 修正方案 | 状态 |
|---|------|----------|------|
| 1 | `HasActiveUserSubscription` 不识别 `pending_activation` | 修改为 `WHERE (status='active' AND end_time>?) OR status='pending_activation'` | ✅ |
| 2 | `PreConsumeUserSubscription` 查询不含 `pending_activation` | 修改查询包含 pending_activation，并在循环中先激活后消费 | ✅ |
| 3 | `ActivationWindowSeconds=0` 导致立即过期 | 改为 `window > 0` 条件判断，0=无限制 | ✅ |
| 4 | 激活时未更新 `StartTime` | 激活时设置 `StartTime=now`，进度条使用 `ActivatedAt` 或 `StartTime` | ✅ |
| 5 | `AdminBindSubscription` 未立即激活 `on_first_use` | Admin 绑定后立即激活：设置 status/activated_at/start_time/end_time | ✅ |
| 6 | `resolveUserGroupBySubscriptions` 未过滤 `disabled` | 添加 `disabled = false` 过滤条件 | ✅ |
| 7 | Disabled 的 pending 订阅窗口仍在流逝 | 不做特殊处理：窗口从 `CreatedAt` 计算，用户禁用不影响窗口计时 | — |
| 8 | `GetAllActiveUserSubscriptions` 不返回 `pending_activation` | 新增 `GetAllUsableUserSubscriptions`，`GetSubscriptionSelf` 使用 `usable_subscriptions` 字段 | ✅ |
| 9 | `ExpireDueSubscriptions` 未排除 disabled | Disabled 的 pending 订阅时间到了也应标记 expired（符合预期） | — |
| 10 | 分销器缓存 logic | `GetUserActiveSubscriptionPlan` 返回 nil 时，回退调 `HasActiveUserSubscription` 检查 pending_activation | ✅ |

---

## 八、测试方案

### 8.1 后端单元测试（Go）

#### 8.1.1 数据模型

| 编号 | 测试用例 | 输入 | 期望 |
|------|----------|------|------|
| T1.1.1 | `SubscriptionPlan` 含 `ActivationMode` 和 `ActivationWindowSeconds` | 创建 plan 结构体，设 `ActivationMode="on_first_use"`, `ActivationWindowSeconds=2592000` | GORM `Create` 成功，读取后字段一致 |
| T1.1.2 | `UserSubscription` 含 `Priority`/`Disabled`/`ActivatedAt` | 创建 sub 结构体，设 `Priority=3`, `Disabled=false`, `ActivatedAt=0` | 写入 DB 后读取一致 |
| T1.1.3 | `ActivationMode` 默认为 `"immediate"` | 创建 plan 不设 `ActivationMode` | 写入后该字段为 `"immediate"` |
| T1.1.4 | `ActivationWindowSeconds` 默认为 `0` | 创建 plan 不设该字段 | 写入后该字段为 `0` |

#### 8.1.2 `CreateUserSubscriptionFromPlanTx`

| 编号 | 测试用例 | 输入 | 期望 |
|------|----------|------|------|
| T1.2.1 | immediate 计划创建 | `plan.ActivationMode="immediate"`, `plan.DurationUnit="month"`, `plan.DurationValue=1` | `status="active"`, `end_time = now + 1 month`, `start_time = now` |
| T1.2.2 | on_first_use 计划创建 | `plan.ActivationMode="on_first_use"` | `status="pending_activation"`, `end_time=0`, `activated_at=0`, `start_time=now` |
| T1.2.3 | on_first_use 计划创建时不计算 end_time | `plan.DurationUnit="hour"`, `plan.DurationValue=5` | `end_time=0`（待激活后才计算） |
| T1.2.4 | 超过 MaxPurchasePerUser 限制 | `MaxPurchasePerUser=1`，用户已有 1 个同 plan 订阅 | 返回 `ErrSubscriptionPurchaseLimit` |

#### 8.1.3 `PreConsumeUserSubscription` — 激活逻辑

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T1.3.1 | 首次使用触发激活 | 用户有 1 个 `pending_activation` 订阅，激活窗口未过期 | 订阅状态 → `active`，`activated_at = now`，`end_time = now + duration`，`start_time = now`，消费成功 |
| T1.3.2 | 激活窗口内可激活 | `CreatedAt + ActivationWindowSeconds > now` | 成功激活 |
| T1.3.3 | 超出激活窗口自动过期 | `now > CreatedAt + ActivationWindowSeconds > 0` | 订阅状态 → `expired`，不消费，循环跳过 |
| T1.3.4 | `ActivationWindowSeconds=0` 永不超时 | `window=0`，`now > CreatedAt`（创建后很久） | 成功激活 |
| T1.3.5 | disabled 的 pending 不激活 | pending 订阅 disabled=true | 跳过该订阅，跳到下一个或报 insufficient |
| T1.3.6 | 激活时 upgrade plan → 更新用户分组 | plan 有 `UpgradeGroup="vip"` | 激活后用户 `group="vip"` |
| T1.3.7 | 无 upgrade plan → 分组不变 | plan `UpgradeGroup=""` | `applyResolvedUserGroup` 不被调用 |
| T1.3.8 | 激活后正常执行消费 | 激活后 amount_total > 剩余额度 | 从该订阅扣减 amount |

#### 8.1.4 `PreConsumeUserSubscription` — 消费优先级

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T1.4.1 | priority 高的先消耗 | sub1: priority=5, sub2: priority=2 | 先消费 sub1 |
| T1.4.2 | 同 priority 按 end_time 早的先消耗 | sub1: priority=0, end_time=1000; sub2: priority=0, end_time=2000 | 先消费 sub1 |
| T1.4.3 | disabled=true 的 active 订阅被跳过 | sub1: disabled=true, sub2: disabled=false | 跳过 sub1，消费 sub2 |
| T1.4.4 | end_time 已到期的 active 订阅被跳过 | sub1: end_time < now | 不在查询结果中 |
| T1.4.5 | 额度不足时跳过 | sub1: amount_total=100, amount_used=90, amount=20 | 跳过 sub1，尝试下一个 |
| T1.4.6 | 所有订阅额度不足 | 所有 subs 剩余额度 < amount | 返回 "quota insufficient" 错误 |
| T1.4.7 | amount_total=0（无限额度） | time-based plan, amount_total=0 | 不检查额度，直接消费成功 |
| T1.4.8 | 全 disabled → 回退钱包 | 所有 usable 订阅 disabled=true | 返回 "no active subscription" |

#### 8.1.5 `ExpireDueSubscriptions`

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T1.5.1 | 到期 active 订阅 → expired | active sub `end_time < now` | status → `expired` |
| T1.5.2 | pending 超激活窗口 → expired | pending sub, `ActivationWindowSeconds > 0`, `now > CreatedAt + window` | status → `expired` |
| T1.5.3 | pending 未超激活窗口 | pending sub, `now < CreatedAt + window` | 不被 expired |
| T1.5.4 | pending `window=0` 永不过期 | pending sub, `window=0` | 不被 expired |
| T1.5.5 | batch limit 生效 | limit=10，15 个到期 | 只处理 10 个（active batch） |
| T1.5.6 | 过期后触发用户组降级 | 唯一 active sub 过期，`UpgradeGroup="vip"` | 用户 group → `base_level` |
| T1.5.7 | 过期后缓存清除 | 过期处理后 | `InvalidateUserActiveSubPlanCache` 被调用 |
| T1.5.8 | pending 过期不应影响分组 | 只有 pending expired | `resolveUserGroupBySubscriptions` 返回 base_level |

#### 8.1.6 `resolveUserGroupBySubscriptions`

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T1.6.1 | 找到 active upgraded 订阅 | active sub, `upgrade_group="vip"` | 返回 `"vip"` |
| T1.6.2 | disabled 的 active 订阅被排除 | active sub disabled=true, upgrade_group="vip" | 返回 `base_level` |
| T1.6.3 | pending_activation 被排除 | pending sub, upgrade_group="vip" | 返回 `base_level` |
| T1.6.4 | end_time 到期的被排除 | active sub, end_time < now | 返回 `base_level` |
| T1.6.5 | 无任何 active upgraded | 无符合条件的 sub | 返回 `base_level` |

#### 8.1.7 `AdminBindSubscription`

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T1.7.1 | Admin 绑定 on_first_use → 立即激活 | plan `ActivationMode="on_first_use"` | sub `status="active"`, `end_time=now+duration`, `activated_at=now` |
| T1.7.2 | Admin 绑定 immediate → 正常激活 | plan `ActivationMode="immediate"` | sub `status="active"` |

#### 8.1.8 `UserInvalidateOwnSubscription`

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T1.8.1 | 取消 active 订阅 | sub status="active" | status → `"cancelled"`, `end_time=now` |
| T1.8.2 | 取消 pending_activation 订阅 | sub status="pending_activation" | status → `"cancelled"`，不触发 group downgrade |
| T1.8.3 | 取消 expired 订阅被拒绝 | sub status="expired" | 返回 "该订阅不在生效状态" |

---

### 8.2 后端 API 集成测试（HTTP）

#### 8.2.1 Admin Plan CRUD

| 编号 | 测试用例 | 请求 | 期望 |
|------|----------|------|------|
| T2.1.1 | 创建 on_first_use 计划 | `POST` admin plan，设 `activation_mode="on_first_use"`, `activation_window_seconds=2592000` | 200，返回 plan 含正确字段 |
| T2.1.2 | 非法 activation_mode 归一化为 immediate | `activation_mode="invalid"` | 200，plan `activation_mode="immediate"` |
| T2.1.3 | 负 activation_window_seconds 归零 | `activation_window_seconds=-100` | 200，plan `activation_window_seconds=0` |
| T2.1.4 | 更新 plan 的 activation_mode | `PUT` admin plan，改 `activation_mode` | 200，字段已更新 |
| T2.1.5 | 更新后 cache 失效 | 更新 plan 后立即 `GetSubscriptionPlanById` | 读到最新值 |

#### 8.2.2 `GET /api/subscription/self` 增强返回

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T2.2.1 | 返回 `usable_subscriptions` 字段 | 用户有 active + pending 订阅 | `usable_subscriptions` 包含两者，`subscriptions` 只含 active |
| T2.2.2 | plan 信息嵌入 | 订阅有对应 plan | 每个 subscription 含 `plan` 字段，有 `title`, `activation_mode` 等 |
| T2.2.3 | progress 信息（active 时间套餐） | active 时间套餐，end_time > start_time | `progress.time_total_seconds > 0`, `progress.time_elapsed_seconds >= 0` |
| T2.2.4 | progress 信息（active 额度套餐） | active 额度套餐，amount_total > 0 | `progress.quota_total > 0`, `progress.quota_percent >= 0` |
| T2.2.5 | pending_activation 无 progress | pending sub | `progress=null` |
| T2.2.6 | expired 无 progress | expired sub | `progress=null` |
| T2.2.7 | `all_subscriptions` 包含所有状态 | 用户有 active + expired | 全部返回 |

#### 8.2.3 `PUT /api/subscription/self/priority`

| 编号 | 测试用例 | 请求 | 期望 |
|------|----------|------|------|
| T2.3.1 | 正常设置优先级 | `{"subscription_ids": [3, 1, 2]}` | 200，sub3 priority=3, sub1=2, sub2=1 |
| T2.3.2 | 空数组 | `{"subscription_ids": []}` | 200，无操作 |
| T2.3.3 | 别人的订阅 id | 传非当前用户的 sub id | `RowsAffected=0`，不报错但实际不改 |
| T2.3.4 | 更新后 cache 失效 | 提交后调用 `GetUserActiveSubscriptionPlan` | 返回正确 plan |

#### 8.2.4 `POST /api/subscription/self/toggle/:id`

| 编号 | 测试用例 | 请求 | 期望 |
|------|----------|------|------|
| T2.4.1 | 禁用 active 订阅 | `{"disabled": true}` | 200，`disabled=true` |
| T2.4.2 | 启用已禁用的订阅 | `{"disabled": false}` | 200，`disabled=false` |
| T2.4.3 | 禁用 pending_activation 订阅 | `{"disabled": true}` | 200，不会被激活 |
| T2.4.4 | 操作别人的订阅 | 传非当前用户的 sub id | 返回 "无权限或订阅不存在" |
| T2.4.5 | 缺少 disabled 参数 | `{}` | 400 "参数错误" |

#### 8.2.5 计费路由测试

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T2.5.1 | subscription_only + 有 pending | preference="subscription_only"，pending sub | 走订阅侧，触发激活并消费 |
| T2.5.2 | subscription_only + 无任何订阅 | 无 active/pending | 预消费失败 |
| T2.5.3 | subscription_first + 有 pending | pending sub，钱包有余额 | 走订阅侧 |
| T2.5.4 | subscription_first + 无订阅 | 无任何订阅 | 回退到钱包 |
| T2.5.5 | wallet_first + pending + 钱包足 | wallet_first，钱包充足 | 走钱包侧，pending 不被激活 |
| T2.5.6 | wallet_first + 钱包不足 | wallet_first，钱包余额不足 | 回退到订阅侧，触发激活 |

---

### 8.3 前端组件测试

#### 8.3.1 菜单与路由

| 编号 | 测试用例 | 操作 | 期望 |
|------|----------|------|------|
| T3.1.1 | 侧边栏显示"订阅管理"菜单 | 以登录用户访问 | 侧边栏 finance 区域可见"订阅管理"菜单项 |
| T3.1.2 | 点击菜单跳转 | 点击"订阅管理" | URL 变为 `/console/subscription-self` |
| T3.1.3 | 直接访问 URL | 访问 `/console/subscription-self` | 渲染 SubscriptionManagement 页面 |
| T3.1.4 | 未登录访问 | 未登录访问该路由 | 重定向到登录页 |
| T3.1.5 | 钱包页不显示订阅状态 | 访问钱包页 | `showMySubscription={false}`，订阅区域不可见 |

#### 8.3.2 SubscriptionManagement 组件渲染

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T3.2.1 | 加载中显示 Loading | API 未返回 | 显示 Spin 组件 |
| T3.2.2 | 无订阅时显示空状态 | `usable_subscriptions=[]` | 显示 "暂无订阅套餐" 文案和 GripVertical 图标 |
| T3.2.3 | 有订阅时渲染卡片列表 | 有 3 个 usable 订阅 | 渲染 3 张 SortableCard |
| T3.2.4 | API 错误时显示错误提示 | 模拟 API 500 | 显示 "获取订阅信息失败" 的 Toast |

#### 8.3.3 SortableCard 卡片展示

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T3.3.1 | 时间套餐显示标签 | plan `activation_mode="on_first_use"` | 显示蓝色 "时间套餐" Tag |
| T3.3.2 | 额度套餐显示标签 | plan `activation_mode="immediate"`, `total_amount > 0` | 显示琥珀色 "额度套餐" Tag |
| T3.3.3 | pending 状态 badge | sub `status="pending_activation"` | 显示 "待激活" Tag（light-blue），卡片左侧边框 tertiary 色 |
| T3.3.4 | active 状态 badge（时间套餐） | sub `status="active"`, time plan | 显示 Clock 图标 "使用中" Tag |
| T3.3.5 | active 状态 badge（额度套餐） | sub `status="active"`, quota plan | 显示 CheckCircle2 图标 "使用中" Tag |
| T3.3.6 | disabled 状态 badge | sub `disabled=true` | 显示 "已禁用" Tag（grey），左侧边框灰色 |
| T3.3.7 | expired 状态 badge | sub `status="expired"` | 显示 "已过期" Tag |
| T3.3.8 | cancelled 状态 badge | sub `status="cancelled"` | 显示 "已取消" Tag |
| T3.3.9 | pending 提示文案 | pending sub | 显示 "首次使用 API 时将自动激活" |

#### 8.3.4 进度条渲染

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T3.4.1 | 时间进度条显示 | `progress.time_total_seconds > 0` | 渲染 TimeProgressBar，显示 "已用 X天X小时 / 剩余 X天X小时" |
| T3.4.2 | 额度进度条显示 | `progress.quota_total > 0` | 渲染 QuotaProgressBar，显示已用/总额和百分比 |
| T3.4.3 | 时间进度条绿色(<50%) | elapsed/total < 50% | 进度条颜色 `var(--semi-color-success)` |
| T3.4.4 | 时间进度条黄色(50%-75%) | elapsed/total 在 50%-75% | 进度条颜色 `var(--semi-color-warning)` |
| T3.4.5 | 时间进度条红色(>75%) | elapsed/total > 75% | 进度条颜色 `var(--semi-color-danger)` |
| T3.4.6 | 额度进度条蓝色(<70%) | used/total < 70% | 进度条颜色 `var(--semi-color-primary)` |
| T3.4.7 | 额度进度条黄色(70%-90%) | used/total 在 70%-90% | 进度条颜色 `var(--semi-color-warning)` |
| T3.4.8 | 额度进度条红色(>90%) | used/total > 90% | 进度条颜色 `var(--semi-color-danger)` |

#### 8.3.5 计费偏好选择器

| 编号 | 测试用例 | 前置条件 | 期望 |
|------|----------|----------|------|
| T3.5.1 | 有 active 订阅时选项可点 | 有 active non-disabled 订阅 | "优先订阅" 和 "仅用订阅" enabled |
| T3.5.2 | 只有 pending 时选项可点 | 有 pending non-disabled 订阅 | "优先订阅" 和 "仅用订阅" enabled |
| T3.5.3 | 全部 disabled 时选项灰掉 | 只有 disabled 订阅 | "优先订阅" 和 "仅用订阅" disabled |
| T3.5.4 | 切换计费偏好 | 选择 "仅用钱包" | 调用 `PUT /self/preference`，显示 "计费偏好已更新" Toast |

---

### 8.4 UI 交互测试

#### 8.4.1 拖拽排序

| 编号 | 测试用例 | 操作 | 期望 |
|------|----------|------|------|
| T4.1.1 | 拖拽改变顺序 | 拖动卡片 A 到卡片 B 下方 | A 移到 B 下方，列表重排 |
| T4.1.2 | 释放后调用 API | 拖拽结束 | 发送 `PUT /self/priority`，请求体 `subscription_ids` 为新顺序 |
| T4.1.3 | 拖拽到相同位置 | 拖动后放回原位 | 不触发 API 调用（`active.id === over.id`） |
| T4.1.4 | 拖拽中卡片样式 | 正在拖拽 | 被拖拽卡片 `opacity: 0.5` |
| T4.1.5 | API 持久化失败 | 模拟网络错误 | 显示 "操作失败" Toast |
| T4.1.6 | 刷新页面后顺序保持 | 拖拽调整后 → F5 | 卡片按新顺序展示 |

#### 8.4.2 Toggle 禁用/启用

| 编号 | 测试用例 | 操作 | 期望 |
|------|----------|------|------|
| T4.2.1 | 禁用 active 订阅 | 点击 active 卡片的 Switch | Switch 变 unchecked，卡片左侧边框变灰色，显示 "已禁用" badge |
| T4.2.2 | 启用已禁用的订阅 | 点击已禁用卡片的 Switch | Switch 变 checked，恢复原状态显示 |
| T4.2.3 | 禁用 pending 订阅 | 点击 pending 卡片的 Switch | 状态可切换 |
| T4.2.4 | expired/cancelled 的 Switch 不可操作 | 查看 expired 卡片 | Switch 处于 disabled 状态 |
| T4.2.5 | Toggle 成功提示 | 操作成功 | 显示 "已禁用套餐"/"已启用套餐" Toast |
| T4.2.6 | Toggle 失败提示 | 模拟网络错误 | 显示 "操作失败" Toast |

#### 8.4.3 国际化

| 编号 | 测试用例 | 操作 | 期望 |
|------|----------|------|------|
| T4.3.1 | 中文环境页面文案 | 语言=zh-CN | 所有文案为中文 |
| T4.3.2 | 英文环境页面文案 | 语言=en | 所有文案为英文 |
| T4.3.3 | 其他语言（fr/ja/ru/vi/zh-TW） | 切换语言 | 至少不崩溃，显示对应翻译或 fallback |
| T4.3.4 | 时间单位国际化（en） | 语言=en，时间进度条 | 显示 "Xh Ym" / "Xd Xh" |
| T4.3.5 | 时间单位国际化（zh-CN） | 语言=zh-CN | 显示 "X小时X分钟" / "X天X小时" |

---

### 8.5 集成测试（端到端）

#### 8.5.1 购买 → 待激活 → 首次使用 → 消费 → 到期 全流程

| 编号 | 测试用例 | 步骤 | 验证点 |
|------|----------|------|--------|
| T5.1.1 | 完整生命周期 | 1. 创建 on_first_use 计划（月套餐，30天窗口）<br>2. 用户购买该计划<br>3. 查看订阅状态 → pending_activation<br>4. 发 API 请求触发激活<br>5. 查进度条 → 剩余约30天<br>6. 模拟时间前进 30 天<br>7. 查 cron → 订阅 expired | 步骤 3: `GET /self` 返回 pending<br>步骤 4: 订阅变为 active，进度条出现<br>步骤 5: `time_remaining` ≈ 2592000s<br>步骤 7: 订阅状态变为 expired，用户分组回退 |

#### 8.5.2 激活窗口到期

| 编号 | 测试用例 | 步骤 | 验证点 |
|------|----------|------|--------|
| T5.2.1 | 窗口内激活 | 1. 购买 30 天窗口计划<br>2. 29 天后发 API | 成功激活 |
| T5.2.2 | 窗口外 API 触发主动过期 | 1. 购买 30 天窗口计划<br>2. 31 天后发 API | `PreConsumeUserSubscription` 中发现过期，标记 expired，不激活 |
| T5.2.3 | cron 批量过期 | 1. 购买 30 天窗口计划<br>2. 不调用 API，等 31 天<br>3. 触发 `ExpireDueSubscriptions` | 订阅自动标记 expired |

#### 8.5.3 消费优先级综合场景

| 编号 | 测试用例 | 步骤 | 验证点 |
|------|----------|------|--------|
| T5.3.1 | 优先级排序消费 | 1. 用户有 sub1(priority=5) 和 sub2(priority=2)<br>2. 发多个 API 请求 | 先消耗 sub1，sub1 耗尽后才消耗 sub2 |
| T5.3.2 | 禁用后跳过 | 1. 禁用 sub1<br>2. 发 API | 跳过 sub1，直接消耗 sub2 |
| T5.3.3 | 拖拽后消费顺序改变 | 1. 拖拽 sub2 到 sub1 上方<br>2. 发 API | 先消耗 sub2（priority 更高了） |
| T5.3.4 | 全部禁用到钱包回退 | 1. 禁用全部订阅<br>2. 发 API（subscription_first 模式） | 消耗钱包余额 |

#### 8.5.4 分组升级/降级

| 编号 | 测试用例 | 步骤 | 验证点 |
|------|----------|------|--------|
| T5.4.1 | 购买 immediate 升级计划 | 1. 用户 base_level="default"<br>2. 购买 UpgradeGroup="vip" 的立即激活计划 | 用户 group → "vip" |
| T5.4.2 | 激活 pending 计划触发升级 | 1. 购买 UpgradeGroup="vip" 的 on_first_use 计划<br>2. 发 API 激活 | 激活后用户 group → "vip" |
| T5.4.3 | pending 期间不升级 | 1. 购买 UpgradeGroup="vip" 的 on_first_use 计划<br>2. 不激活 | 用户 group 保持 base_level |
| T5.4.4 | 唯一升级订阅过期后降级 | 1. 购买 UpgradeGroup="vip" 的 immediate 计划<br>2. 等它过期 | 用户 group → base_level |
| T5.4.5 | disabled 升级订阅不参与分组 | 1. 禁用唯一的 upgraded 订阅 | 用户 group → base_level |

#### 8.5.5 并发安全

| 编号 | 测试用例 | 步骤 | 验证点 |
|------|----------|------|--------|
| T5.5.1 | 并发激活同一 pending 订阅 | 同时发 2 个 API | 只有 1 个成功激活，另一个看到已 active 的订阅 |
| T5.5.2 | 并发消费同一订阅 | 同时发多个 API | `AmountUsed` 正确累加，不超扣 |
| T5.5.3 | 并发 Toggle + 消费 | 一个请求禁用，一个请求消费 | 数据一致，不 panic |

---

### 8.6 边界情况测试

| 编号 | 测试用例 | 条件 | 期望 |
|------|----------|------|------|
| T6.1 | 时间套餐到期发生在请求中 | 请求处理期间 end_time 变成 < now | `end_time > now` 预消费前过滤 |
| T6.2 | 同一计划多次购买 | `MaxPurchasePerUser=3`，购买 4 次 | 第 4 次购买被拒绝 |
| T6.3 | 购买 0 总金额的时间套餐 | plan `total_amount=0` | 创建成功，消费不检查额度 |
| T6.4 | 购买 0 总金额的额度套餐 | plan `total_amount=0` | 创建成功，不显示额度进度条 |
| T6.5 | activation_window_seconds=0 | 创建 plan 设 `window=0` | pending 永不过期 |
| T6.6 | 已激活的 pending 订阅重复预消费 | 同 requestId 重试 | 幂等返回原结果 |
| T6.7 | 退款后 refund 订阅预扣 | `RefundSubscriptionPreConsume` | 配额退还，record status="refunded" |
| T6.8 | Admin 绑定后立即使用 | Admin 绑定 on_first_use 计划 → 用户发 API | 订阅已 active，正常消费 |
| T6.9 | 空 subscription_ids 拖拽 | 只拖拽 1 个卡片 | 不报错 |

---

### 8.7 数据库兼容性测试

| 编号 | 测试用例 | 数据库 | 期望 |
|------|----------|--------|------|
| T7.1 | AutoMigrate 创建新字段 | SQLite / MySQL / PostgreSQL | 三个 DB 下均能自动添加 `priority`, `disabled`, `activated_at`, `activation_mode`, `activation_window_seconds` |
| T7.2 | 现有订阅兼容 | 旧数据（无新字段） Upgrade | 新字段使用 default 值（priority=0, disabled=false, activated_at=0），不影响现网 |
| T7.3 | 带新字段的 CRUD 三库一致 | 创建/读取/更新/查询 | 三种 DB 行为一致 |

---

### 8.8 测试执行优先级

| 优先级 | 测试范围 | 说明 |
|--------|----------|------|
| **P0** | T5.1 完整生命周期 | 核心流程必须通过 |
| **P0** | T1.3.1-T1.3.8 激活逻辑 | 首次使用激活是核心新功能 |
| **P0** | T1.4.1-T1.4.8 消费优先级 | 优先级排序是新功能 |
| **P1** | T1.5 过期处理 | 定时任务正确性 |
| **P1** | T2.2 API 增强返回 | 前后端联调依赖 |
| **P1** | T4.1 拖拽 + T4.2 Toggle | 主要 UI 交互 |
| **P1** | T5.5 并发安全 | 生产稳定性 |
| **P2** | T3 前端渲染 | UI 展示正确性 |
| **P2** | T4.3 国际化 | 多语言 |
| **P2** | T7 数据库兼容 | 多 DB 支持 |
| **P3** | T6 边界情况 | 防御性验证 |
