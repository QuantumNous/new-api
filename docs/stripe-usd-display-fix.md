# Stripe 美元显示修复说明

## 背景

站点已经将全局额度展示类型切换为 `USD`，但充值确认弹窗中仍然出现了人民币显示，例如：

- 充值数量：`$1.00`
- 实付金额：`7元`

这会造成两个问题：

1. 用户界面展示不一致，页面已经是美元，弹窗却仍显示人民币。
2. 容易误以为 Stripe 实际按人民币结算。

## 结论

这个问题分成两部分：

### 1. 前端符号显示问题

充值确认弹窗原先存在写死人民币文案/单位的情况，没有统一走站点当前货币配置。

已定位的关键位置：

- `web/src/components/topup/index.jsx`
  - `renderAmount()` 原先直接返回 `amount + ' 元'`
- `web/src/components/topup/modals/PaymentConfirmModal.jsx`
  - 原价、优惠金额原先直接拼接 `元`

修复方式：

- 统一改为调用 `getCurrencyConfig()`，根据当前 `quota_display_type` 动态显示 `$` / `¥` / 自定义符号。

### 2. Stripe 金额配置问题

即使前端符号修复完成，如果后台 `StripeUnitPrice=7`，那么 1 个充值单位仍会计算出金额 `7`。

相关后端逻辑：

- `controller/topup_stripe.go`
  - `getStripePayMoney()`
  - 金额计算公式：

```go
payMoney := amount * setting.StripeUnitPrice * topupGroupRatio * discount
```

这意味着：

- 如果 `StripeUnitPrice=7`
  - 充值 1 单位时，前端会拿到金额 `7`
- 当前站点切到 `USD` 后
  - 符号会显示成 `$`
  - 结果就会变成 `$7`

所以：

- 前端修的是“货币符号显示”
- 后台 `StripeUnitPrice` 修的是“金额本身”

## 已修改内容

### 1. 充值确认金额显示改为动态货币符号

文件：

- `web/src/components/topup/index.jsx`

修改点：

- `renderAmount()` 不再写死 `元`
- 改为使用：

```jsx
const { symbol } = getCurrencyConfig();
return `${symbol}${amount}`;
```

效果：

- `USD` 模式显示 `$`
- `CNY` 模式显示 `¥`
- `CUSTOM` 模式显示自定义符号

### 2. 确认弹窗中的原价/优惠金额改为动态货币符号

文件：

- `web/src/components/topup/modals/PaymentConfirmModal.jsx`

修改点：

- 引入 `getCurrencyConfig`
- 将以下写死人民币的展示：

```jsx
${originalAmount.toFixed(2)} 元
- ${discountAmount.toFixed(2)} 元
```

改为：

```jsx
${symbol}${originalAmount.toFixed(2)}
- ${symbol}${discountAmount.toFixed(2)}
```

## 仍需后台调整的配置

如果目标是“只显示美元，且 Stripe 也按美元金额结算”，除了前端代码修复外，还需要同步调整后台配置。

### 1. 全站展示货币

确保：

- `general_setting.quota_display_type = USD`

作用：

- 用户界面金额统一按美元显示

### 2. Stripe 单价

确保：

- `StripeUnitPrice` 填的是“每个充值单位对应的美元价格”
- 不要再按“人民币汇率”填写

例如：

- 如果 1 个充值单位就是 `$1`
  - `StripeUnitPrice = 1`
- 如果 1 个充值单位是 `$10`
  - `StripeUnitPrice = 10`

### 3. Stripe PriceId

确保：

- `StripePriceId` 对应的是 Stripe 后台里创建的 `USD` 价格

否则会出现：

- 站内显示 `$1`
- Stripe Checkout 实际收 `$7`

这种前后不一致的问题。

## 建议的最终配置

如果你的目标是：

- 站内显示美元
- Stripe 结账也是美元
- 1 个充值单位 = 1 美元

则建议配置为：

- `general_setting.quota_display_type = USD`
- `StripeUnitPrice = 1`
- `StripePriceId = Stripe 后台 USD 1.00 的 price_xxx`

## 验证方式

修改完成后，建议按以下顺序验证：

1. 重新构建并发布前端资源。
2. 打开充值页，选择 Stripe。
3. 检查充值确认弹窗：
   - `充值数量` 是否显示 `$`
   - `实付金额` 是否显示 `$`
   - `原价/优惠` 是否不再显示 `元`
4. 点击进入 Stripe Checkout：
   - 检查 Stripe 页面币种是否为 `USD`
   - 检查金额是否与站内显示一致

## 风险提示

当前 Stripe 设置页中的文案仍然偏向旧语义，例如：

- `充值价格（x元/美金）`
- `例如：7，就是7元/美金`

这类文案会继续误导管理员把 `StripeUnitPrice` 当作人民币汇率来填写。

建议后续继续调整后台文案，改成明确的美元语义，例如：

- `每个充值单位对应的 USD 金额`
- `例如：1 表示 1 个充值单位收费 $1`

## 修改后是否会影响充值

如果你修改的是“展示文案”和“格式化输出”，通常不会影响实际充值。

### 一般不会影响充值的修改

以下修改通常只影响显示，不影响 Stripe 实际支付和入账：

- 前端弹窗里的 `元` 改成动态货币符号
- 日志文案中的 `使用在线充值成功` 改成更准确的渠道名称
- 金额显示从 `%.6f` 改成 `%.2f`
- 将 `充值金额`、`支付金额` 这类字段名称统一

这些修改不会直接改变：

- Stripe Checkout 创建逻辑
- Webhook 验签逻辑
- 订单状态流转
- 用户额度入账逻辑

### 可能影响充值的修改

如果改动涉及下面这些逻辑，就需要谨慎验证：

- `StripePriceId`
- `StripeUnitPrice`
- `getStripePayMoney()`
- `Recharge()` 中的入账计算
- Stripe Webhook 处理分支
- `TopUp.Amount` / `TopUp.Money` 的含义和使用方式

这些部分一旦改错，可能出现：

- 页面显示金额正确，但 Stripe Checkout 金额不一致
- 支付成功但未入账
- 入账金额错误
- 订单状态未更新为成功

### 建议的回归验证

修改完成后，建议至少验证一遍完整充值链路：

1. 打开充值页，选择 Stripe，确认弹窗中金额和货币符号正确。
2. 进入 Stripe Checkout，确认币种是 `USD`，金额与站内一致。
3. 用 Stripe 测试支付完成后，确认用户余额已正确增加。
4. 查看充值记录和充值日志，确认：
   - 文案已更新
   - 订单状态为 `success`
   - 金额显示符合预期

### 实际判断原则

可以按下面这个原则判断风险：

- 只改“文案/符号/小数位数” = 通常安全
- 改“价格计算/支付参数/Webhook/入账逻辑” = 需要完整回归测试
