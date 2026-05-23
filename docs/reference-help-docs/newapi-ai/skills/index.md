# Skills

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/skills/index.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/skills/index.mdx

## 页面大纲

  - 概述
  - 支持的 AI 编辑器
  - 了解更多

## 原文内容

---
title: Skills
description: New API 官方 AI 编辑器 Skill 插件一览，支持 Claude Code、Codex 与 OpenClaw（龙虾）。可直接在 AI 编码助手中管理模型、令牌、分组与余额，并提问 New API 的使用问题。
---
import { Card, Cards } from 'fumadocs-ui/components/card';
import { User, Shield } from 'lucide-react';

## 概述

**Skills** 是一种轻量级扩展协议，让 AI 编辑器（如 Claude Code、Codex、OpenClaw（龙虾）、Cursor、Windsurf 等）能够在编码环境内直接与 New API 交互，无需切换到浏览器或管理面板。

New API Skills 现已支持在 Claude Code、Codex、OpenClaw（龙虾）等工具中直接执行查询模型、管理令牌、查看余额，以及提问 New API 使用问题等操作。

New API 目前提供以下 Skills：

<Cards>
  <Card
    icon={<User />}
    title="newapi"
    description="用户级 Skill — 在 Claude Code、Codex、OpenClaw（龙虾）中查询模型、管理令牌、查看分组和余额，并直接提问 New API 使用问题。"
    href="/zh/docs/skills/newapi"
  />
  <Card
    icon={<Shield />}
    title="newapi-admin（敬请期待）"
    description="管理员级 Skill — 渠道管理、用户管理、系统配置等运维操作。面向 New API 管理员。"
    href="/zh/docs/skills/newapi-admin"
  />
</Cards>

## 支持的 AI 编辑器

所有 Skills 均可在以下 AI 编码工具中使用：

| AI 编辑器 / 编码助手 | 类型 | 备注 |
|----------------------|------|------|
| **Claude Code** | 终端 AI 编程助手 | Anthropic 官方 CLI |
| **OpenClaw** | 自托管 AI 助手平台 | 支持 Skills，可在对话中直接调用 `/newapi` 指令 |
| **Cursor** | AI 原生代码编辑器 | 基于 VS Code |
| **Windsurf** | AI 代码编辑器 | Codeium 出品 |
| **Cline** | VS Code AI 扩展 | 开源 AI 编码代理 |
| **Codex CLI** | 终端 AI 编程助手 | OpenAI 官方 CLI |

> 任何支持 Skills 协议的 AI 工具都可以使用 New API Skills。

## 了解更多

- GitHub 仓库：[github.com/QuantumNous/skills](https://github.com/QuantumNous/skills)
- New API 官网：[www.newapi.ai](https://www.newapi.ai)
