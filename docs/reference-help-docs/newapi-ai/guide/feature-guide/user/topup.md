# 配额与充值

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/user/topup.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/user/topup.mdx

## 页面大纲

  - 充值方式
  - 在线支付充值
    - 选择充值金额
    - 完成支付
  - 兑换码充值
    - 输入兑换码
    - 完成兑换
  - 邀请返利
    - 获取邀请码
    - 使用返利配额

## 原文内容

---
title: 配额与充值
description: 配额是平台内部计费单位，支持多种方式充值
---
配额是平台内部计费单位，消耗量 = 实际 Token 数 × 模型倍率。左侧导航点击「钱包管理」，或直接访问 `/console/topup`。

## 充值方式

![充值页面](../../../assets/guide/feature-guide/topup.png)

支持在线支付充值和兑换码两种方式增加账户配额。

| 充值方式 | 说明 |
| --- | --- |
| 兑换码 | 输入管理员生成的兑换码，直接增加配额 |
| EPay | 国内聚合支付（支付宝、微信等） |
| Stripe | 国际信用卡支付 |
| Creem / Waffo | 国际支付平台 |

## 在线支付充值

### 选择充值金额

在充值页选择充值金额，或手动输入自定义金额

### 完成支付

1. 选择支付方式（EPay / Stripe / Creem / Waffo）

![选择支付方式](../../../assets/guide/feature-guide/topup-payment.png)

2. 点击「充值」按钮，页面跳转至对应支付平台
3. 在支付平台完成付款后，自动跳回平台，账户余额更新

## 兑换码充值

### 输入兑换码

1. 在充值页找到「兑换码」输入区域
2. 在输入框中粘贴或输入管理员提供的兑换码

![兑换码输入区域](../../../assets/guide/feature-guide/topup-redeem.png)

### 完成兑换

1. 点击「兑换」按钮，系统验证兑换码有效性
2. 兑换成功后页面提示获得的配额数量，账户余额同步更新

## 邀请返利

每个账号都有唯一的邀请码，邀请他人注册并消费后可获得返利配额。

### 获取邀请码

在充值页或个人设置页找到「邀请」区域，复制你的专属邀请码

![邀请码与返利区域](../../../assets/guide/feature-guide/topup-invite.png)

### 使用返利配额

1. 将邀请码分享给他人，对方注册时填写邀请码
2. 被邀请用户消费后，你的返利配额余额自动增加
3. 点击「转入余额」按钮，将返利配额转入账户主余额后即可使用
