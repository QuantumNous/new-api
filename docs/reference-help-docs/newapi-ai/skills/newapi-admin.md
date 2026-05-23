# newapi-admin（敬请期待）

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/skills/newapi-admin.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/skills/newapi-admin.mdx

## 页面大纲

  - 简介
  - 计划功能
    - 渠道管理
    - 用户管理
    - 系统配置
    - 日志与监控
    - 令牌与兑换码管理
  - 与 newapi Skill 的区别
  - 关注进展

## 原文内容

---
title: newapi-admin（敬请期待）
description: newapi-admin 是 New API 官方管理员级 Skill 插件，支持在 Claude Code、Cursor、Windsurf 等 AI 编辑器中直接执行渠道管理、用户管理、系统配置、日志查询等管理员运维操作。正在开发中，敬请期待。
---
import { Callout } from 'fumadocs-ui/components/callout';

<Callout type="warn" title="开发中 — 敬请期待">
  **newapi-admin** 目前正在开发中，尚未发布。以下为计划支持的功能预览。正式发布后本页面将更新为完整文档。
</Callout>

## 简介

**newapi-admin** 是面向 New API 管理员的 Skill 插件。与用户级的 [newapi](/zh/docs/skills/newapi) Skill 不同，newapi-admin 专注于**管理员运维场景**，让站点管理员在 AI 编辑器中通过自然语言指令完成日常管理任务，无需登录管理后台。

## 计划功能

### 渠道管理

| 指令（规划中） | 说明 |
|---------------|------|
| `/newapi-admin channels` | 列出所有渠道及其状态 |
| `/newapi-admin channel-add` | 添加新渠道（OpenAI、Claude、Gemini、Azure 等） |
| `/newapi-admin channel-test <id>` | 测试指定渠道的连通性 |
| `/newapi-admin channel-toggle <id>` | 启用或禁用指定渠道 |
| `/newapi-admin channel-priority` | 查看和调整渠道优先级 |

### 用户管理

| 指令（规划中） | 说明 |
|---------------|------|
| `/newapi-admin users` | 列出用户列表 |
| `/newapi-admin user-info <id>` | 查看用户详情（余额、分组、用量） |
| `/newapi-admin user-quota <id>` | 调整用户配额和余额 |
| `/newapi-admin user-group <id> <group>` | 修改用户所属分组 |
| `/newapi-admin user-ban <id>` | 封禁或解封用户 |

### 系统配置

| 指令（规划中） | 说明 |
|---------------|------|
| `/newapi-admin config` | 查看当前系统配置 |
| `/newapi-admin config-set <key> <value>` | 修改系统配置项 |
| `/newapi-admin ratio` | 查看模型倍率设置 |
| `/newapi-admin ratio-sync` | 同步上游模型倍率 |

### 日志与监控

| 指令（规划中） | 说明 |
|---------------|------|
| `/newapi-admin logs` | 查看最近的请求日志 |
| `/newapi-admin stats` | 查看系统统计数据（请求量、消耗、错误率） |
| `/newapi-admin status` | 检查系统健康状态和渠道连通性 |

### 令牌与兑换码管理

| 指令（规划中） | 说明 |
|---------------|------|
| `/newapi-admin redemptions` | 列出兑换码 |
| `/newapi-admin redemption-create` | 批量创建兑换码 |
| `/newapi-admin token-overview` | 全局令牌使用概览 |

## 与 newapi Skill 的区别

| | newapi | newapi-admin |
|---|--------|-------------|
| **面向用户** | 普通用户 / 开发者 | 站点管理员 |
| **操作范围** | 个人模型、令牌、余额、分组 | 全局渠道、用户、配置、日志 |
| **权限要求** | 用户访问令牌 | 管理员访问令牌 |
| **状态** | 已发布 | 开发中 |

## 关注进展

newapi-admin 正在积极开发中，欢迎关注仓库获取最新动态：

- GitHub 仓库：[github.com/QuantumNous/skills](https://github.com/QuantumNous/skills)
- 已发布的用户级 Skill：[newapi](/zh/docs/skills/newapi)
