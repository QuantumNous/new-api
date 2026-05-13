---
name: zhidou-ironline-guard
description: 守护知豆三条高压线:auth.go 的 New-Api-User 校验、relay.go 的 Pre/Refund 配对、支付回调。任何 PR 改动这些文件就强制人工介入
when_to_use: 每条 PR 提交时,自动检查是否触碰高压线
---

# Skill: zhidou-ironline-guard

## 作用

知豆 AI 有三条"高压线"——改错了会导致安全事故或资金损失的关键代码。本 Skill 在每条 PR 提交时自动检查,一旦触碰高压线,立即阻止并要求人工审批。

## 三条高压线

### 高压线 1:用户身份校验(`middleware/auth.go`)

**关键代码**:
- 文件:`c:/Users/道初/Desktop/3D/new-api/middleware/auth.go`
- 行号:95-122
- 功能:`New-Api-User` header 校验,防止用户冒充他人

**为什么是高压线**:
- 如果这段逻辑被破坏,攻击者可以在 header 里随便填别人的 user_id,越权操作
- 影响:数据泄漏、资金盗窃、账号接管

**允许的改动**:
- 无。这段代码在 Agent 改造期间**绝对不能动**。

### 高压线 2:计费配对(`controller/relay.go`)

**关键代码**:
- 文件:`c:/Users/道初/Desktop/3D/new-api/controller/relay.go`
- 行号:225-236
- 功能:`PreConsumeBilling()` 预扣费 + `Refund()` 失败退款的配对逻辑

**为什么是高压线**:
- 如果 Pre/Refund 不配对,会导致:
  - 用户被多扣费(Pre 了但没 Refund)
  - 平台亏损(没 Pre 但调用成功了)
- 影响:资金损失、用户投诉、法律风险

**允许的改动**:
- 无。这段代码在 Agent 改造期间**绝对不能动**。

### 高压线 3:支付回调(`controller/topup.go` 等)

**关键文件**:
- `c:/Users/道初/Desktop/3D/new-api/controller/topup.go`
- `c:/Users/道初/Desktop/3D/new-api/controller/stripe.go`
- `c:/Users/道初/Desktop/3D/new-api/controller/creem.go`
- `c:/Users/道初/Desktop/3D/new-api/controller/waffo.go`

**关键函数**:
- `StripeWebhook()` / `CreemWebhook()` / `WaffoWebhook()`
- 功能:验证支付签名 + 更新用户余额

**为什么是高压线**:
- 如果签名验证被绕过,攻击者可以伪造充值请求,白嫖余额
- 影响:平台直接亏损

**允许的改动**:
- 无。这些文件在 Agent 改造期间**绝对不能动**。

## 执行步骤

### 第 1 步:检查 PR diff

读取 PR 的文件变更列表:

```bash
git diff --name-only origin/main...HEAD
```

### 第 2 步:匹配高压线文件

检查变更列表是否包含:
- `middleware/auth.go`
- `controller/relay.go`
- `controller/topup.go`
- `controller/stripe.go`
- `controller/creem.go`
- `controller/waffo.go`

### 第 3 步:如果触碰高压线

**立即阻止 PR 合入**,输出警告:

```
🚨 高压线警告 🚨

本 PR 修改了以下高压线文件:
- middleware/auth.go

这些文件在 Agent 改造期间绝对不能动,因为:
- middleware/auth.go:用户身份校验,改错会导致越权攻击

如果你确实需要修改这些文件,请:
1. 在团队会议上说明修改原因和影响范围
2. 由项目负责人人工审批
3. 审批通过后,在 PR 描述里添加 [IRONLINE-APPROVED] 标记

未经审批的高压线修改将被自动驳回。
```

### 第 4 步:人工审批流程

如果 PR 描述里含 `[IRONLINE-APPROVED]` 标记:
1. 检查审批人是否有权限(项目负责人 / 安全负责人)
2. 检查 PR 描述是否说明了修改原因
3. 通过后,在 PR 评论里留档:"高压线修改已审批,原因:<原因>"

## Hook 配置(自动化)

把本 Skill 配置成 PreToolUse Hook,在 Claude Code 尝试编辑高压线文件前自动触发:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "tool": "Edit",
        "condition": "file_path matches (middleware/auth.go|controller/relay.go|controller/topup.go|controller/stripe.go|controller/creem.go|controller/waffo.go)",
        "action": "block",
        "message": "🚨 高压线文件!请先调用 Skill zhidou-ironline-guard 确认是否允许修改。"
      }
    ]
  }
}
```

## 报告模板

```markdown
# 高压线检查报告 - PR #<编号>

## 检查结果

- [ ] ✅ 未触碰高压线
- [ ] ⚠️ 触碰高压线,需人工审批
- [ ] ❌ 触碰高压线,未经审批,驳回

## 触碰的高压线

### 高压线 1:用户身份校验

**文件**:`middleware/auth.go`

**变更**:
```diff
- if userIdHeader != strconv.Itoa(userId) {
+ if userIdHeader != strconv.Itoa(userId) && !isAdmin {
```

**风险**:引入了 `isAdmin` 豁免逻辑,可能被滥用。

**审批状态**:❌ 未审批

---

## 处理建议

<如果未审批>本 PR 触碰高压线且未经审批,建议驳回。如确需修改,请走人工审批流程。

<如果已审批>本 PR 已获审批,可以合入,但需在合入后立即跑一次完整回归测试。
```

## 注意事项

1. **零容忍**:高压线文件未经审批,一律驳回,不允许"先合入再改"。
2. **审批留档**:每次审批都要在 PR 评论里留档,方便后续审计。
3. **定期审查**:每季度审查一次高压线清单,看是否需要增减。
