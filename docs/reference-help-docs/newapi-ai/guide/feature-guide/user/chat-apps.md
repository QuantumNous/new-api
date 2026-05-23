# 聊天应用集成

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/feature-guide/user/chat-apps.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/feature-guide/user/chat-apps.mdx

## 页面大纲

  - 一键导入配置
    - 使用方法
  - ChatGPT Next Web
  - Lobe Chat
    - 配置步骤
  - AI as Workspace
    - 使用方法
  - AMA 问天
    - 使用方法
  - OpenCat
    - 使用方法
  - 手动配置其他应用
    - 配置信息
    - 通用配置步骤

## 原文内容

---
title: 聊天应用集成
description: 快速将 New API 配置导入到各类 AI 聊天应用中
---
import { Callout } from 'fumadocs-ui/components/callout';

New API 支持快速导入配置到多种 AI 聊天应用，方便测试和日常使用。

## 一键导入配置

在控制台→令牌页面可以一键导入配置到支持的聊天应用中。

![一键导入配置](../../../assets/guide/import-chat-config.png)

### 使用方法

1. 在令牌列表页找到要使用的令牌
2. 点击令牌右侧的「导入」或「配置」按钮
3. 选择目标聊天应用
4. 系统自动跳转到对应应用并填充配置信息

## ChatGPT Next Web

<Callout type="warn">
  ChatGPT Next Web 目前暂停部署
</Callout>

## Lobe Chat

<Callout type="info">
  Lobe Chat 是一款开源的多模态对话应用，支持多种大语言模型（LLM）和插件扩展。它不仅可以实现文本对话，还支持图片、音频等多模态交互，适用于个人助理、知识问答、内容创作等多种场景。Lobe Chat 拥有简洁直观的界面，支持多端同步，用户可以根据需求自定义模型和插件，灵活扩展对话能力。无论是开发者还是普通用户，都能轻松上手，享受智能对话带来的高效体验。
</Callout>

<Callout type="warn">
  Lobe Chat 目前不支持从 New API 一键导入配置，需要手动填写
</Callout>

### 配置步骤

1. 打开 Lobe Chat 应用
2. 进入设置页面，找到「语言模型」配置区域
3. 按照以下信息填写配置：

![Lobe Chat 配置填写 - 步骤1](../../../assets/guide/lobechat-1.png)

- **API 地址**：填写 New API 平台的 Base URL
- **API Key**：填写在 New API 创建的令牌

![Lobe Chat 配置填写 - 步骤2](../../../assets/guide/lobechat-2.png)

4. 点击「保存」完成配置
5. 在模型选择中即可看到 New API 提供的所有可用模型

## AI as Workspace

<Callout type="info">
  AI as Workspace 是一种将人工智能能力集成到工作空间中的创新方式。通过将 AI 助手与日常办公、协作、知识管理等场景深度结合，用户可以更高效地处理信息、自动化重复任务，并获得智能建议，提升整体工作效率和体验。
</Callout>

<Callout type="info">
  支持从 New API 一键导入配置
</Callout>

### 使用方法

1. 在 New API 令牌页面点击「导入到 AI as Workspace」
2. 系统自动跳转到 AI as Workspace 并填充配置
3. 确认配置信息后即可开始使用

## AMA 问天

<Callout type="info">
  AMA 问天是 New API 提供的智能问答助手，支持多轮对话和复杂问题解答。用户可以通过自然语言与 AMA 问天进行交流，获取知识、技术支持或业务咨询，提升沟通效率和体验。
</Callout>

<Callout type="warn">
  需要先安装 AMA 问天 app
</Callout>

### 使用方法

1. 从应用商店下载并安装 AMA 问天应用
2. 在 New API 令牌页面点击「导入到 AMA 问天」
3. 应用自动打开并完成配置
4. 开始与 AI 助手对话

## OpenCat

<Callout type="info">
  OpenCat 是一款开源的多平台 AI 聊天客户端，支持多种大语言模型接入。用户可以通过简洁的界面与 AI 进行自然语言对话，适用于日常交流、知识问答和内容创作等多种场景。OpenCat 支持多端同步，配置灵活，适合个人和团队使用。
</Callout>

<Callout type="warn">
  需要先安装 OpenCat app
</Callout>

### 使用方法

1. 从应用商店下载并安装 OpenCat 应用
2. 在 New API 令牌页面点击「导入到 OpenCat」
3. 应用自动打开并完成配置
4. 在 OpenCat 中选择模型开始对话

## 手动配置其他应用

对于不支持一键导入的应用，可以手动配置：

### 配置信息

从 New API 获取以下信息：

| 配置项 | 说明 | 获取位置 |
| --- | --- | --- |
| API Base URL | API 接口地址 | 平台首页或令牌页面 |
| API Key | 令牌密钥 | 创建令牌时显示（仅一次） |
| 可用模型 | 支持的模型列表 | 个人设置→可用模型 或 定价页面 |

### 通用配置步骤

1. 在目标应用中找到「设置」或「配置」入口
2. 找到「自定义 API」或「OpenAI 兼容接口」配置区域
3. 填写 API Base URL 和 API Key
4. 保存配置后即可使用

<Callout type="info">
  大多数支持 OpenAI API 的应用都可以通过填写自定义 API 地址的方式接入 New API
</Callout>
