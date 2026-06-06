# classic vs default 全量功能差异审计报告

> 审计时间：2026-06-05
> 审计目的：在生产环境已运行的情况下，确保 default 前端不丢功能、不改坏
> 审计方法：逐页/逐功能对比 classic 与 default 的实现细节

---

## 一、订阅（Subscription）模块 — **多项细节缺失**

### 1.1 套餐表单：`bind_group`（绑定分组）字段缺失 🔴 重要

| 项 | classic | default |
|---|---|---|
| 字段 | `bind_group` 存在 | **完全缺失** |
| 字段 | `upgrade_group` 存在 | 存在 |
| 表单 | Semi `Form.Select`，`extraText` 解释「绑定后，该分组下的所有用户自动拥有此套餐。变更分组时自动同步。」 | 无此字段 |
| 表格列 | 有「绑定分组」列 | 无 |
| API payload | `bind_group` 一并提交 | 丢失 |

**影响**：
- 已绑定分组的套餐在 default 编辑后会**丢失** `bind_group` 值（被覆盖为空）
- 「手动同步」按钮失去前提（找不到 bind_group 的 plan）
- 表格上无法看出哪些套餐已绑定分组

**位置**：
- classic: `web/classic/src/components/table/subscriptions/modals/AddEditSubscriptionModal.jsx`（第 98、125、169、350 行）
- classic: `web/classic/src/components/table/subscriptions/SubscriptionsColumnDefs.jsx`（第 248-269 行 `renderBindGroup`，第 370 行绑定列）
- default 缺失：`web/default/src/features/subscriptions/lib/plan-form.ts`、`subscriptions-mutate-drawer.tsx`、`subscriptions-columns.tsx`

### 1.2 「手动同步」按钮缺失 🔴 重要

classic 表格行操作里有 **手动同步** 按钮（`SubscriptionsColumnDefs.jsx` `renderOperations` 第 339-345 行），点击后调用：

```js
POST /api/user/group-sync
  body: { full: false, group_name: plan.bind_group, only_missing: true }
```

用途：当套餐 `bind_group` 已设置但用户尚未自动同步时，管理员一键同步该分组的所有用户到对应套餐。

default 的 `data-table-row-actions.tsx` 只有 **编辑 / 启用-禁用** 两项，**缺手动同步**。

### 1.3 套餐表格「支付渠道」列缺失 🟡 中等

classic 有 `renderPaymentConfig` 列（第 286-309 行），同时展示 `Stripe / Creem / 易支付` 三个 Tag。

default 只有 `stripe_price_id` 和 `creem_product_id` 两个独立列，**没有易支付 (epay) 标识**，且没有合并的「支付渠道」概览列。

### 1.4 订阅价格Popover 详情卡缺失 🟡 中等

classic 表格中「套餐标题」列是 Popover（`SubscriptionsColumnDefs.jsx` 第 79-130 行），悬停显示完整详情（价格、总额度、升级分组、购买上限、有效期、重置周期）。default 只有纯文本。

### 1.5 Usage View 部分中文 i18n 缺失 🔴 用户可见

`web/default/src/features/subscriptions/components/subscription-usage-dashboard.tsx` 中下列 key 在 zh.json 没有翻译（仍为英文）：

| Key | 应译为 |
|---|---|
| `Used / Total` | `已用 / 总量` |
| `Filter by org` | `按组织筛选` |
| `No plan` | `无套餐` |
| `Total Users` | `总用户数` |
| `Active Users` | `活跃用户` |
| `Users Inactive For {{days}} Days` | `非活跃 {{days}} 天的用户` |
| `Loading...` | `加载中...` |
| `No data` | `暂无数据` |
| `User` | `用户` |
| `Org` | `组织` |
| `Group` | `分组` |
| `Status` | `状态` |
| `Last Login` | `最后登录` |
| `Quota` | `额度` |
| `Tokens` | `Token` |
| `Refresh` | 已有 |
| `Month` | 已有（"月"） |

(部分可能已有，需全量核对，详见修复列表)

### 1.6 Subscription 父页面 Tab i18n 缺失 🟡

`subscriptions/index.tsx`:
- `Plans` — en/zh 都缺（应为「套餐管理」）
- `Group Mapping` — en/zh 都缺（应为「分组映射」）
- `Usage View` — en/zh 都缺（应为「用量视图」）
- `Subscription Management` — 已有

### 1.7 Subscriptions Actions "Create Plan" i18n 缺失 🟡

`subscriptions-primary-buttons.tsx` 第 35 行 `t('Create Plan')` — en/zh 都缺（应为「新建套餐」）

---

## 二、飞书 OAuth 登录 ✅ 已完整

default 已有完整实现：
- `web/default/src/features/auth/components/oauth-providers.tsx` — 当 `status.feishu_oauth === true` 时渲染飞书按钮
- `web/default/src/features/auth/hooks/use-oauth-login.ts` — `handleFeishuLogin`
- `web/default/src/assets/brand-icons/icon-feishu.tsx` — 飞书图标
- `web/default/src/features/auth/types.ts` — `feishu_oauth`、`feishu_auth_policy` 字段

**结论：飞书 OAuth 完整可用**，无需修改。

---

## 三、用户模型统计页（迁移项 1）✅ 本轮已迁移

- 路由：`/user-model-stats`
- 侧边栏：admin 区域已加入口
- 三 Tab：用户视角 / 模型视角 / 用户模型消耗
- 筛选：日期、用户名、模型名、分组
- 分页 + 导出 CSV
- i18n：en/zh 都补齐

**注意**：尚未在浏览器实测真实 API（dev server 已停）

---

## 四、其他页面快速扫描（未深挖）

| classic 页面 | default 对应 | 状态 |
|---|---|---|
| Dashboard | `/dashboard` | ✅ |
| Channel | `/channels` | ✅ |
| Token | `/keys` | ✅ |
| Log | `/usage-logs` | ✅ |
| User | `/users` | ✅ |
| Redemption | `/redemption-codes` | ✅ |
| Setting (Operation/Ratio/...) | `/system-settings/*` | ✅ 分模块 |
| Midjourney | （task 抽象统一） | ✅ |
| Playground | `/playground` | ✅ |
| Pricing | `/pricing` | ✅ |
| Model | `/models` | ✅ |
| ModelDeployment | `/models/deployments` | ✅ |
| Chat | `/chat/$chatId` | ✅ |
| Chat2Link | `/chat2link` | ✅ |
| Profile/Personal | `/profile` | ✅ |
| Subscription | `/subscriptions` | ⚠️ 缺 bind_group 等细节（见第一节） |
| UserModelStats | `/user-model-stats` | ✅ 本轮新增 |

---

## 五、优先级修复清单

按重要性排序，逐项确认后再改：

### P0（影响生产数据/功能正确性）

1. **套餐表单补齐 `bind_group` 字段**
   - 在 `plan-form.ts` schema + defaults + 转换函数加入 `bind_group`
   - 在 `subscriptions-mutate-drawer.tsx` 加入 `bind_group` Select（同 `upgrade_group`）
   - 在 `subscriptions-columns.tsx` 加入「绑定分组」列
   - 在 `types.ts` 的 `subscriptionPlanSchema` 加入 `bind_group: z.string().optional()`

2. **表格行操作加回「手动同步」**
   - 在 `data-table-row-actions.tsx` 增加 `RefreshCw` 菜单项
   - 调用 `POST /api/user/group-sync` (body: `{ full: false, group_name: plan.bind_group, only_missing: true }`)
   - 仅当 `bind_group` 非空时启用，否则禁用并提示

### P1（用户体验/可见性）

3. **补齐 Usage View 中文翻译**（17 个 key）
4. **补齐 Subscription 主页面 3 个 Tab 翻译**：`Plans`, `Group Mapping`, `Usage View`
5. **补齐 `Create Plan` 翻译**

### P2（细节增强，非阻塞）

6. **「支付渠道」合并列**：将 stripe + creem + epay 合并成一列 Tag
7. **套餐标题 Popover 详情**：悬停显示完整规格

---

## 六、风险与建议

1. **bind_group 修复是 P0**：default 现在的编辑流程会**清空已绑定分组的套餐字段**，生产用户编辑即破坏数据，必须立刻修。
2. **手动同步**：管理员日常会用，default 没有等于功能缺失。
3. **i18n 翻译**：中文用户看英文 key 体验差，但**不影响功能**，可与 P0 一起修。
4. 建议按 P0 → P1 → P2 顺序提交，每一项独立提交方便回滚。

---

## 七、待用户确认事项

请确认：

1. ✅ 飞书 OAuth 不改（已完整）
2. ✅ 用户模型统计页（本轮已迁移）
3. 是否同意按 P0 → P1 → P2 顺序修复订阅模块？
4. 「支付渠道」合并列（P2）和「套餐标题 Popover」（P2）要不要做？做的话改动较大；不做也能用。
5. 是否还有其他你发现的功能缺失未列在此报告里？
