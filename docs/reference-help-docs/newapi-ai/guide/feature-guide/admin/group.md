# 分组管理

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/admin/group.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/admin/group.mdx

## 页面大纲

  - 分组的使用方式

## 原文内容

---
title: 分组管理
description: 分组用于隔离不同用户的渠道访问权限和计费倍率
---
import { Callout } from 'fumadocs-ui/components/callout';

分组用于隔离不同用户的渠道访问权限和计费倍率，不同分组的用户只能使用分配给该分组的渠道。使用管理员账号登录后，在系统设置或管理面板中找到「分组」入口。

分组列表展示平台所有已配置的分组名称。用户和令牌均可指定所属分组，渠道也可限定只对特定分组开放。

## 分组的使用方式

- **用户分组**：在用户管理页编辑用户时，可为用户指定所属分组
- **令牌分组**：创建令牌时可指定该令牌使用的渠道分组
- **渠道分组**：添加渠道时可在「分组」字段填写允许访问该渠道的分组名称

<Callout type="info">
  令牌分组设为 `auto` 时，系统按优先级顺序自动选择一个可用分组，适合需要跨分组容灾的场景。
</Callout>
