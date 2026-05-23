# 令牌管理

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/user/token.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/user/token.mdx

## 页面大纲

  - 创建令牌
    - 基本配置
    - 高级配置选项
    - 保存令牌 Key
  - 编辑令牌
  - 删除令牌

## 原文内容

---
title: 令牌管理
description: 令牌是调用 API 的凭证，每个令牌可独立配置权限范围和配额上限
---
import { Callout } from 'fumadocs-ui/components/callout';

令牌是调用 API 的凭证，每个令牌可独立配置权限范围和配额上限。左侧导航点击「令牌」，或直接访问 `/console/token`。

![令牌列表页](../../../assets/guide/feature-guide/token-list.png)

令牌列表展示所有已创建的令牌，包含名称、状态、已用配额、剩余配额、过期时间等信息。

## 创建令牌

### 基本配置

1. 在令牌列表页点击右上角「创建令牌」按钮，弹出创建弹窗
2. 填写令牌名称（建议按用途命名，如「生产环境」「测试用」）

![创建令牌弹窗](../../../assets/guide/feature-guide/token-create.png)

### 高级配置选项

按需配置以下选项：

| 配置项 | 说明 |
| --- | --- |
| 过期时间 | 设置有效期，留空或设为 -1 表示永不过期 |
| 剩余配额 | 限制该令牌可消耗的最大配额，超出后自动失效 |
| 无限配额 | 开启后不受配额限制（仍受账户总配额约束） |
| 模型限制 | 限定该令牌只能调用指定模型，留空表示不限制 |
| IP 白名单 | 限定允许使用该令牌的来源 IP，留空表示不限制 |
| 分组 | 指定该令牌使用的渠道分组 |

### 保存令牌 Key

点击「提交」，弹窗显示完整的令牌 Key，**立即复制保存**，关闭弹窗后无法再次查看完整 Key

![令牌创建成功，显示完整 Key](../../../assets/guide/feature-guide/token-created-key.png)

<Callout type="warn">
  令牌 Key 仅在创建时完整显示一次，请立即复制保存。令牌 Key 具有完整的 API 调用权限，请勿泄露给他人，不要提交到代码仓库。
</Callout>

## 编辑令牌

在令牌列表中找到目标令牌，点击右侧「编辑」按钮，可修改令牌的配置选项（不包括令牌 Key 本身）。

## 删除令牌

在令牌列表中找到目标令牌，点击右侧「删除」按钮，确认后该令牌立即失效，无法恢复。
