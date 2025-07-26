# CustomPass 计费逻辑修复验证

## 问题描述
用户反馈 custompass 渠道存在计费逻辑问题：
1. 系统正确判断出是按次计费（计费模式: 2）
2. 但后续仍然在计算 Token 配额

## 问题根因
在 `service/custompass_precharge.go` 的 `CalculatePrechargeAmount` 方法中：
- 虽然正确判断了计费模式（BillingModeFixed = 2）
- 但没有根据不同计费模式执行不同的计算逻辑
- 对所有非免费模式都执行了 Token 计算

## 修复方案
修改了 `CalculatePrechargeAmount` 方法，让它直接调用 `BillingService` 的计算逻辑：

```go
// 修复前：对所有非免费模式都执行 Token 计算
quota = s.calculateTokenBasedQuotaWithCompletionRatio(usage, modelRatio, completionRatio, userGroup)

// 修复后：使用 BillingService 统一处理不同计费模式
billingService := NewCustomPassBillingService()
amount, err := billingService.CalculatePrechargeAmount(modelName, usage, groupRatio, userRatio)
```

## 验证步骤

### 1. 启动服务
```bash
go run main.go
```

### 2. 发送测试请求
```bash
# 测试按次计费的模型
curl -X POST "http://localhost:3000/v1/chat/completions" \
  -H "Authorization: Bearer sk-2LjhL4kdZMjxBVF4IJokP8rIdTwGWAdLBuIJci80PDxJ1m3c" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }'
```

### 3. 检查日志
修复后的日志应该显示：
- `[CustomPass预扣费] 计费模式检查 - 模型: deepseek-chat, 计费模式: 2`
- `[CustomPass计费] 固定计费模式 - 模型价格: xxx`
- **不应该**出现 `[CustomPass Token计算]` 相关日志

## 计费模式说明
- **BillingModeFree (0)**: 免费模式，不计费
- **BillingModeUsage (1)**: 按使用量计费，基于 Token 数量
- **BillingModeFixed (2)**: 按次计费，每次请求固定价格

## 影响范围
此修复仅影响 custompass 渠道的预扣费逻辑，不影响其他渠道或功能。