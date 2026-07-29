# 恢复 Staging 邀请页面说明文案设计

- 日期：2026-07-29
- 状态：已确认，待实施计划
- 分支：`fix/restore-staging-invitation-page-copy`

## 背景

PR #591 将邀请页面卡片说明和外部分享内容合并为同一个动态 `rewardMessage`。因此订阅邀请模式会在页面上展示套餐折扣说明，不再显示 staging 原有的充值结算说明。

本次只恢复邀请页面说明为 staging 当前文案，不回退 PR #591 的邀请业务逻辑，也不修改复制、邮件、X 或 LinkedIn 的外部分享内容。

## 目标行为

邀请页面的“您的邀请链接”卡片固定使用现有国际化键：

`Share your referral link with friends. Referral rewards are processed after their first successful top-up.`

中文显示为：

`与好友分享您的邀请链接。好友首次成功充值后，系统会结算邀请奖励。`

页面说明不再随 `rewardMode` 改变。外部分享内容继续按现有逻辑区分默认模式、订阅模式和充值模式。

## 方案比较

### 方案一：分离页面说明和分享内容（采用）

保留动态分享消息，将其命名为 `shareMessage`，只传给 `buildInvitationShareLinks`。`TitledCard.description` 独立使用 staging 已有的页面说明国际化键。

该方案改动最小，并明确区分页面解释文案与用户主动发送给外部的分享文案，避免两类文案再次相互覆盖。

### 方案二：按邀请模式维护两套页面说明

为订阅模式和充值模式分别设置页面说明。该方案会继续让页面说明受活动配置影响，与“固定恢复 staging 页面文案”的目标不符。

### 方案三：整体回退 PR #591 的前端文案改动

该方案会同时回退用户要求保留的动态外部分享文案，并可能带回与当前邀请业务不一致的旧行为，因此不采用。

## 实现范围

生产代码只修改：

- `web/default/src/features/invitations/components/referral-link-card.tsx`

测试主要修改：

- `web/default/src/features/invitations/components/invitation-view.test.tsx`
- 必要时补强 `web/default/src/features/invitations/invitations-i18n.test.ts`

现有 8 个 locale 文件已经包含目标国际化键及真实翻译，预计无需修改翻译值：

- `en`
- `zh`
- `fr`
- `ru`
- `ja`
- `vi`
- `es`
- `pt`

## 测试策略

按照测试驱动流程实施：

1. 先增加回归断言，证明订阅邀请模式下页面说明仍错误地显示动态套餐文案。
2. 同一测试同时确认外部分享链接仍编码当前订阅模式分享文案，防止修复页面说明时误改分享行为。
3. 修改组件，使页面说明和分享内容分别取值。
4. 验证 8 个 locale 均包含目标页面说明键，且翻译值不是缺失或错误回退。
5. 运行邀请模块测试、国际化检查、类型检查、lint 和前端构建。

## 非目标

- 不修改邀请奖励配置字段或后端结算逻辑。
- 不修改复制、邮件、X、LinkedIn 的外部分享文案。
- 不新增国际化键或依赖。
- 不修改公开官网 `website/`。
- 不合并或推送 `main`、`staging`，不自动创建 PR。

## 完成标准

1. 无论邀请奖励模式为何，邀请链接卡片页面说明都显示对应语言的 staging 文案。
2. 订阅模式等外部分享内容保持 PR #591 后的当前动态文案。
3. 8 种语言均可正确解析页面说明，不发生英文键回退或缺失。
4. 目标测试、国际化校验、类型检查、lint 和构建通过。
