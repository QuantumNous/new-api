# 虎皮椒（XunhuPay）支付接入设计

日期：2026-07-10  
状态：已确认

## 目标

为钱包充值（TopUp）新增虎皮椒支付网关，作为独立 `PaymentProvider`，不接入订阅。

参考文档：https://www.xunhupay.com/doc/api/pay.html

## 范围

### 做

- 独立 Provider：`xunhu`
- 仅用户钱包充值
- PC 展示 `url_qrcode` 扫码；手机/微信跳转 `url`
- 微信 + 支付宝双渠道配置；凭证留空的渠道不展示
- 独立单价 / 最低充值
- Default + Classic 前端（充值页 + 管理端设置）

### 不做

- 订阅支付
- 退款 / 查单接口
- 挂入易支付 `PayMethods`

## 架构与流程

```
用户选金额 + 支付方式(wxpay|alipay)
  → POST /api/user/xunhu/pay
       合规门禁 + 渠道凭证校验
       按 XunhuUnitPrice / 分组倍率计算应付人民币
       创建 TopUp(pending, provider=xunhu)
       POST 虎皮椒网关（JSON + MD5 hash）
       返回 { url, url_qrcode, trade_no }
  → 前端：PC 展示 url_qrcode；移动端跳转 url
  → 虎皮椒 POST /api/xunhu/notify（form）
       验签 → status==OD → 行锁入账 → 返回 "success"
  → 浏览器跳转 return_url
```

## 配置项（options）

| 键 | 含义 | 默认 |
|---|---|---|
| `XunhuEnabled` | 总开关 | `false` |
| `XunhuGatewayUrl` | 支付网关 URL | `https://api.xunhupay.com/payment/do.html` |
| `XunhuWxAppId` | 微信 AppID | 空 |
| `XunhuWxAppSecret` | 微信 AppSecret | 空 |
| `XunhuAliAppId` | 支付宝 AppID | 空 |
| `XunhuAliAppSecret` | 支付宝 AppSecret | 空 |
| `XunhuUnitPrice` | 每单位额度对应人民币（元） | `1` |
| `XunhuMinTopUp` | 最低充值额度 | `1` |

启用条件：`XunhuEnabled` + 支付合规已确认 + 至少一组（微信或支付宝）AppId/Secret 齐全。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/user/xunhu/pay` | 拉起支付（登录） |
| `POST` | `/api/user/xunhu/amount` | 试算应付金额（登录） |
| `POST` | `/api/xunhu/notify` | 异步回调（公开，验签） |

拉起请求：`{ amount, payment_method: "wxpay"|"alipay" }`  
拉起响应：`{ url, url_qrcode, trade_no }`  
回调成功：纯文本 `success`

## 签名

非空参数按参数名 ASCII 字典序拼接为 `key=value&...`，末尾直接拼接对应渠道 `AppSecret`（无连接符），MD5 得 32 位小写。`hash` 字段不参与签名。请求与回调共用算法。

## 入账

`model.RechargeXunhu`：

- 校验 `PaymentProvider == xunhu`
- 回调 `status == OD`
- 事务 + 行锁，幂等（已成功直接返回 success）
- `quota = Amount * QuotaPerUnit`（与 Epay/Waffo 一致）

## 前端

### GetTopUpInfo 扩展

- `enable_xunhu_topup`
- `xunhu_min_topup`
- `xunhu_pay_methods`：动态列表
  - 微信凭证齐全 → `{ type: "wxpay", name: "微信支付" }`
  - 支付宝凭证齐全 → `{ type: "alipay", name: "支付宝" }`
  - 仅一项时只显示该项

### 充值交互

- 调 `/api/user/xunhu/pay`
- 桌面端：弹层展示 `url_qrcode`
- 移动端：跳转 `url`
- `return_url` 回充值页；额度以 notify 为准

### 管理端

Default / Classic 均增加虎皮椒设置区块：开关、网关、微信/支付宝凭证、单价、最低充值；密钥字段脱敏。

## 关键文件（实现清单）

### Backend

- `setting/payment_xunhu.go` — 配置变量与渠道辅助方法
- `model/option.go` — Init/Update
- `model/topup.go` — Provider 常量 + `RechargeXunhu`
- `controller/topup_xunhu.go` — 拉起 / 试算 / 回调
- `controller/payment_webhook_availability.go` — `isXunhuTopUpEnabled`
- `controller/topup.go` — `GetTopUpInfo` 注入字段
- `router/api-router.go` — 路由

### Frontend Default

- wallet constants / api / hooks / payment lib / recharge UI
- system-settings payment settings section

### Frontend Classic

- topup 组件 + Payment 设置页

## 错误处理

- 签名失败 / 非 OD：不入账，不返回 `success`（触发重试）
- 重复回调：已成功则返回 `success`
- 拉起失败：返回明确错误，不产生成功订单
