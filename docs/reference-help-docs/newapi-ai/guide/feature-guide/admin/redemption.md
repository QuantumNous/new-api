# 兑换码管理

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/redemption.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/redemption.mdx

## 页面大纲

  - 批量生成兑换码
    - 打开生成弹窗
    - 设置生成参数
    - 生成兑换码
    - 导出兑换码

## 原文内容

---
title: 兑换码管理
description: 批量生成和管理配额兑换码
---
批量生成和管理配额兑换码，用于活动赠送或用户充值。使用管理员账号登录后，左侧导航点击「兑换码」，或直接访问 `/console/redemption`。

![兑换码列表页](/assets/guide/feature-guide/redemption-list.png)

兑换码列表展示所有已生成的兑换码，包含码值（部分遮挡）、面值、使用状态（未使用 / 已使用）、创建时间。

## 批量生成兑换码

### 打开生成弹窗

在兑换码列表页点击「生成兑换码」按钮，弹出生成弹窗

![生成兑换码弹窗](/assets/guide/feature-guide/redemption-create.png)

### 设置生成参数

填写以下参数：
- **名称**：便于识别的批次名称
- **面值**：每张兑换码对应的配额数量
- **数量**：本次生成的兑换码张数

### 生成兑换码

点击「生成」，系统批量创建兑换码并显示在列表中

![生成完成后的兑换码列表](/assets/guide/feature-guide/redemption-created.png)

### 导出兑换码

可点击列表中的「导出」按钮，将兑换码导出为文件，方便批量分发
