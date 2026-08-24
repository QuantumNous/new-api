# 对齐邀请页面订阅说明文案设计

- 日期：2026-07-29
- 状态：已确认，待实施
- 分支：`fix/align-invitation-subscription-page-copy`

## 背景

PR #597 只恢复了邀请链接卡片顶部的 staging 说明。邀请页摘要和“如何获得奖励”的三步说明仍直接读取接口返回的 `reward_mode`，因此线上返回非 `subscription` 时会切回充值奖励文案，无法与 staging 当前可见的订阅说明保持一致。

用户要求页面说明不再受该配置字段影响。业务金额和奖励上限仍读取接口数据，外部分享和后端结算逻辑保持不变。

## 目标文案

页面摘要固定使用订阅说明，并动态插入双方奖励金额：

`邀请好友订阅：他们立即获得 {{inviteeReward}} 套餐抵扣；其首次成功购买付费套餐后，你获得 {{inviterReward}} 套餐抵扣。`

奖励次数为无限时显示：

`奖励不限次数，套餐抵扣永不过期，任何邮箱地址均可参与。`

“如何获得奖励”固定显示订阅三步：

1. `分享邀请链接` / `将您的专属邀请链接发送给好友。`
2. `好友完成注册` / `好友注册后立即获得套餐抵扣。`
3. `你获得 {{reward}} 套餐抵扣` / `好友首次成功购买付费套餐后，你立即获得 {{reward}} 套餐抵扣。套餐抵扣永不过期，仅可用于套餐购买或续费。`

有限奖励次数继续显示现有订阅版单数或复数上限文案，次数仍来自 `inviter_reward_max_count`。

## 方案比较

### 方案一：在页面组合层显式传入指导文案模式（采用）

`InvitationView` 定义固定的订阅指导模式，并传给 `InvitationRewardSummary` 与 `RewardStepsCard`。两个组件用该模式选择说明文案，但继续从 `summary` 读取金额和上限。

该方案把“页面怎么说明”和“接口当前是什么奖励模式”明确分离，范围只覆盖用户指出的摘要与三步说明。

### 方案二：在两个子组件中直接写死订阅分支（不采用）

代码更少，但组件内部无法说明为什么忽略 `reward_mode`，后续维护者容易重新接回接口字段。

### 方案三：修改接口或环境配置（不采用）

这会改变业务配置和结算语义，不符合“配置字段不管，只对齐页面文案”的范围。

## 实现范围

- `web/default/src/features/invitations/index.tsx`
- `web/default/src/features/invitations/components/invitation-reward-summary.tsx`
- `web/default/src/features/invitations/components/reward-steps-card.tsx`
- `web/default/src/features/invitations/components/invitation-view.test.tsx`

现有 8 个 locale 已包含全部目标键与插值占位符，不修改翻译值：`en`、`zh`、`fr`、`ru`、`ja`、`vi`、`es`、`pt`。

## 保持不变

- 邀请链接卡片顶部说明继续使用 PR #597 恢复的 staging 文案。
- 复制、邮件、X、LinkedIn 分享继续按接口 `reward_mode` 选择消息。
- 统计卡、邀请记录、FAQ、奖励金额、奖励上限、接口和结算逻辑不变。
- 不修改 locale JSON、后端或公开官网。

## 测试策略

1. 先用非订阅 `reward_mode` 构造页面，断言仍显示订阅摘要和三步说明，并确认动态金额与无限上限正确插值。
2. 同一场景确认外部分享仍保留非订阅模式消息，证明只分离页面指导文案。
3. 运行邀请模块全部测试和现有 8 语言完整性测试。
4. 运行 i18n 同步、TypeScript、lint、格式和生产构建。

## 完成标准

1. 页面摘要与三步说明始终和 staging 订阅文案一致。
2. 金额和奖励上限仍反映接口实际数值。
3. 外部分享和其他邀请页面区域没有行为变化。
4. 8 种语言及前端质量门禁全部通过。
