# 支付设置

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/console/settings/payment-settings.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/console/settings/payment-settings.mdx

## 页面大纲

  - 支持的支付网关
  - 什么是易支付
  - 充值方式设置模板
    - 字段说明
  - 充值金额配置
    - 自定义充值数量选项
    - 充值金额折扣配置

## 原文内容

---
title: 支付设置
---
import { Callout } from 'fumadocs-ui/components/callout';

<Callout type="warn">
  支付能力适用于合法授权场景下的内部结算、企业客户账务或合规服务收费。部署方应确保相关服务、收费、上游授权和运营方式符合所在地法律法规、上游服务条款、平台规则和支付风控要求。
</Callout>

这里可以配置充值功能相关的设置

![支付设置](../../../assets/guide/payment-setting.png)

![Stripe](../../../assets/guide/stripe.png)

## 支持的支付网关

- **易支付（EPay）**
  - 必填项：`API 地址`、`商户 ID（PID）`、`商户密钥（KEY）`
  - 平台回调参数包含签名，系统会进行校验并自动入账
- **Stripe（可选）**
  - 必填项：`API 密钥` `WebHook 签名密钥` `商品价格 ID`

## 什么是易支付

`易支付`是对“第三方聚合收款网关/接口”模式的泛称，并非某一家具体的网站或公司。既可指商用聚合支付服务，也可指自建/开源、遵循“易支付协议风格”的网关实现。

- **核心作用**: 聚合微信支付、支付宝、银行卡等渠道，向商户提供统一的下单、签名校验与回调接口。
- **合规提示**: 网关本身不等同于持牌支付机构；资金清结算与合规依赖其对接的持牌渠道，请遵循所在地监管与风控要求。

## 充值方式设置模板

在“充值方式”中，可按以下结构配置：

```json
[
  {
    "color": "rgba(var(--semi-blue-5), 1)",
    "name": "支付宝",
    "type": "alipay"
  },
  {
    "color": "rgba(var(--semi-green-5), 1)",
    "name": "微信",
    "type": "wxpay"
  },
  {
    "color": "rgba(var(--semi-green-5), 1)",
    "name": "Stripe",
    "type": "stripe",
    "min_topup": "50"
  },
  {
    "name": "自定义1",
    "color": "black",
    "type": "custom1",
    "min_topup": "50"
  }
]
```

### 字段说明

- name: 展示文案。显示在"选择支付方式"的按钮上（如"支付宝/微信/Stripe/自定义1"）。
- color: 按钮/徽标的主题色或边框色。支持任意 CSS 颜色值，推荐使用现有设计令牌（如 `rgba(var(--semi-blue-5), 1)`）。
- type: 通道标识，用于后端路由与下单。
  - `stripe` → 走 Stripe 网关。
  - 其他（如 `alipay`、`wxpay`、`custom1` 等）→ 走易支付风格网关，并将该值作为渠道参数透传。
  - 详细逻辑见后端控制器 `controller/topup.go`（参考: [controller/topup.go](https://github.com/QuantumNous/new-api/blob/main/controller/topup.go)）。
- min_topup: 最低充值金额（单位与页面货币一致）。当输入金额小于该值时，页面会提示"此支付方式最低充值金额为 X"，并限制发起支付；后端也会进行校验。
- 排序: 按数组顺序从左到右渲染。

## 充值金额配置

### 自定义充值数量选项

设置用户可选择的充值数量选项，例如：

```json
[10, 20, 50, 100, 200, 500]
```

这些数值会显示在"选择充值额度"区域，用户可以直接点击选择对应的充值金额。

### 充值金额折扣配置

设置不同充值金额对应的折扣，键为充值金额，值为折扣率，例如：

```json
{
  "100": 0.95,
  "200": 0.9,
  "500": 0.85
}
```

- 键：充值金额（字符串格式）
- 值：折扣率（0-1之间的小数，如 0.95 表示 95% 价格，即 5% 折扣）
- 系统会根据配置自动计算实付金额和节省金额
- 折扣功能的使用应符合授权范围、上游服务条款、平台规则和所在地法律法规要求
- 详细实现逻辑见后端控制器 [controller/topup.go](https://github.com/QuantumNous/new-api/blob/main/controller/topup.go)
