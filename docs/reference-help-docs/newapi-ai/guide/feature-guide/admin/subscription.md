# 订阅计划管理

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/subscription.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/subscription.mdx

## 页面大纲

  - 创建套餐
  - 上架 / 下架套餐
  - 为用户手动开通订阅

## 原文内容

---
title: 订阅计划管理
description: 创建和管理订阅套餐
---
创建和管理订阅套餐，控制哪些套餐对用户可见，以及为用户手动开通订阅。使用管理员账号登录后，直接访问 `/console/subscription`（管理员视角与用户购买界面不同）。

![订阅计划管理列表](/assets/guide/feature-guide/sub-admin-list.png)

套餐列表展示所有已创建的订阅套餐，包含名称、价格、有效期、状态（上架 / 下架）等信息。

## 创建套餐

1. 在订阅管理页点击「创建套餐」按钮，弹出创建弹窗

![创建订阅套餐弹窗](/assets/guide/feature-guide/sub-create.png)

2. 填写以下信息：
   - **套餐名称**：用户购买时看到的名称
   - **价格**：套餐售价
   - **有效期类型**：选择日 / 周 / 月 / 自定义天数
   - **包含配额**：套餐内包含的配额数量
3. 点击「提交」，套餐创建完成并默认处于下架状态

## 上架 / 下架套餐

1. 在套餐列表中找到目标套餐，点击右侧「上架」或「下架」按钮

![套餐上架/下架操作](/assets/guide/feature-guide/sub-publish.png)

2. 上架后用户在订阅页可看到并购买该套餐；下架后套餐对用户不可见，但已购买的订阅不受影响

## 为用户手动开通订阅

1. 在订阅管理页点击「手动绑定」按钮
2. 输入目标用户名或邮箱，选择要开通的套餐
3. 点击「确认」，系统为该用户创建订阅记录，立即生效
