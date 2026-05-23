# AI 应用

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/apps/index.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/apps/index.mdx

## 页面大纲

  - 概述
  - 支持的应用
  - 集成指南

## 原文内容

---
title: AI 应用
description: 支持的 AI 应用和集成方案
---
import { Card, Cards } from 'fumadocs-ui/components/card';
import {
  Cherry,
  Sparkles,
  Terminal,
  BookOpen,
  MessageCircle,
  Languages,
  Bot,
  Settings,
} from 'lucide-react';

## 概述

New API 兼容多种流行的 AI 应用和工具。以下是已验证支持的应用列表及配置指南。

## 支持的应用

<Cards>
  <Card
    icon={<Sparkles />}
    title="AionUi"
    description="免费开源的Cowork，支持多模型、文件管理和实时预览。"
    href="/zh/docs/apps/aionui"
  />
  <Card
    icon={<Settings />}
    title="CC Switch"
    description="支持一键填入，点击 New API 后弹窗配置 Claude/Codex/Gemini 及主模型与各型号。"
    href="/zh/docs/apps/cc-switch"
  />
  <Card
    icon={<Cherry />}
    title="Cherry Studio"
    description="功能强大的 AI 助手客户端，支持多模型对话。"
    href="/zh/docs/apps/cherry-studio"
  />
  <Card
    icon={<Bot />}
    title="DeepChat"
    description="开源全功能AI Agent客户端。"
    href="/zh/docs/apps/deepchat"
  />
  <Card
    icon={<Bot />}
    title="Memoh"
    description="容器化 AI 智能体平台，每个机器人独立容器运行，支持长期记忆与多渠道接入。"
    href="/zh/docs/apps/memoh"
  />
  <Card
    icon={<Bot />}
    title="OpenClaw"
    description="自托管 AI 助手平台 — 安装 OpenClaw，对接 New API，支持飞书、Discord、Slack 等多渠道 AI 代理管理。"
    href="/zh/docs/apps/openclaw"
  />
  <Card
    icon={<BookOpen />}
    title="Fluent Read"
    description="AI 驱动的智能阅读和翻译助手。"
    href="/zh/docs/apps/fluent-read"
  />
  <Card
    icon={<MessageCircle />}
    title="LangBot"
    description="基于大语言模型的聊天机器人框架。"
    href="/zh/docs/apps/langbot"
  />
  <Card
    icon={<Languages />}
    title="Luna Translator"
    description="游戏和文档的实时翻译工具。"
    href="/zh/docs/apps/luna-translator"
  />
  <Card
    icon={<Bot />}
    title="AstrBot"
    description="开源的一站式 Agent 聊天机器人平台。"
    href="/zh/docs/apps/astrbot"
  />
  <Card
    icon={<Terminal />}
    title="Claude Code"
    description="Anthropic Claude 驱动的代码编辑器集成。"
    href="/zh/docs/apps/claude-code"
  />
  <Card
    icon={<Terminal />}
    title="Codex CLI"
    description="命令行界面的 AI 代码助手工具。"
    href="/zh/docs/apps/codex-cli"
  />
  <Card
    icon={<Bot />}
    title="Factory Droid CLI"
    description="自动化工作流的 AI 代理工具。"
    href="/zh/docs/apps/factory-droid-cli"
  />
</Cards>

## 集成指南

大多数应用只需要配置以下信息即可连接 New API：

1. **API 地址**：您的 New API 服务地址
2. **API Key**：在 New API 控制台生成的令牌
3. **模型名称**：选择需要使用的模型

具体配置步骤请参考各应用的详细文档。
