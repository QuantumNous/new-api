# newapi

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/skills/newapi.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/skills/newapi.mdx

## 页面大纲

  - 为什么使用 Skills
  - 支持的 AI 编辑器
  - 功能与指令一览
    - 查询类指令
    - 令牌管理指令
    - 帮助指令
  - 安装与配置
  - 运行环境要求
  - 安全机制
  - 了解更多

## 原文内容

---
title: newapi
description: newapi 是 New API 官方用户级 Skill 插件，支持 Claude Code、Codex 和 OpenClaw（龙虾）。通过自然语言指令在 AI 编码助手内查询模型、管理令牌、查看分组和余额，并直接提问 New API 的使用问题。
---
import { Callout } from 'fumadocs-ui/components/callout';
import { Step, Steps } from 'fumadocs-ui/components/steps';

<Callout type="info" title="什么是 newapi-skills？">
  **newapi-skills** 是 New API 官方推出的 AI 编辑器 Skill 插件。Skill 是一种轻量级扩展协议，让 AI 编码助手（如 Claude Code、Codex、OpenClaw（龙虾）、Cursor、Windsurf、Cline 等）能够在编辑器内**直接调用 New API 接口**，完成模型查询、令牌管理、余额查看，以及提问 New API 部署、配置和 API 调用等使用问题，实现真正的"编码即运维"工作流。

  - GitHub 仓库：[github.com/QuantumNous/skills](https://github.com/QuantumNous/skills)

  现在也支持在 OpenClaw（龙虾）中使用，你可以直接在对话工作流里调用 `/newapi` 指令完成模型查询、令牌管理、余额查看，也能直接提问 New API 的使用问题。
</Callout>

## 为什么使用 Skills

在日常 AI 开发中，开发者经常需要在编辑器和 New API 管理面板之间反复切换：查看可用模型、创建 API 令牌、检查余额、调整分组配额……这些操作打断了编码流程。

**newapi-skills 解决的问题：**

- **零切换**：在 Claude Code、Codex、OpenClaw（龙虾）等 AI 编码助手中直接输入自然语言指令，无需打开浏览器或管理后台
- **内置问答**：可直接提问 New API 的部署、配置、分组、模型调用格式等使用问题，快速获得帮助
- **安全优先**：密钥永不明文显示，令牌复制与注入均通过安全通道完成（`sk-` 开头的密钥绝不会出现在终端或日志中）
- **即装即用**：一行 `npx` 命令完成安装，自动检测运行时环境（Bun / Node.js / Deno）
- **多编辑器兼容**：支持所有实现 Skills 协议的 AI 编辑器和编码助手

## 支持的 AI 编辑器

newapi-skills 可在以下 AI 编码工具中使用：

| AI 编辑器 / 编码助手 | 类型 | 备注 |
|----------------------|------|------|
| **Claude Code** | 终端 AI 编程助手 | Anthropic 官方 CLI |
| **OpenClaw** | 自托管 AI 助手平台 | 支持 Skills，可在对话中直接调用 `/newapi` 指令 |
| **Cursor** | AI 原生代码编辑器 | 基于 VS Code |
| **Windsurf** | AI 代码编辑器 | Codeium 出品 |
| **Cline** | VS Code AI 扩展 | 开源 AI 编码代理 |
| **Codex CLI** | 终端 AI 编程助手 | OpenAI 官方 CLI |

> 任何支持 Skills 协议的 AI 工具都可以使用 newapi-skills。

## 功能与指令一览

以下是 newapi-skills 提供的全部指令。这些指令通过 New API REST API 执行，支持查询和管理 New API 实例中的各类资源。

### 查询类指令

| 指令 | 说明 | 用途 |
|------|------|------|
| `/newapi models` | 列出可用 AI 模型 | 查看当前 New API 实例中配置的所有模型（OpenAI、Claude、Gemini 等） |
| `/newapi groups` | 列出用户分组 | 查看账户所属的分组及其配额、倍率设置 |
| `/newapi balance` | 查看账户余额 | 实时查询当前用户的账户余额和用量 |

### 令牌管理指令

| 指令 | 说明 | 用途 |
|------|------|------|
| `/newapi tokens` | 列出 API 令牌 | 查看所有已创建的令牌（密钥以掩码形式显示，如 `sk-reHR**********OspA`） |
| `/newapi create-token <name> [--group=xxx]` | 创建新 API 令牌 | 为不同应用或项目创建独立的 API 密钥 |
| `/newapi switch-group <token_id> <group>` | 切换令牌分组 | 更改令牌所属的分组以调整模型访问权限和倍率 |
| `/newapi copy-token <token_id>` | 复制密钥到剪贴板 | 安全地将真实密钥复制到系统剪贴板（密钥不会显示在终端中） |
| `/newapi apply-token <token_id> <file>` | 注入密钥到配置文件 | 将令牌密钥安全写入项目配置文件（如 `.env`），使用占位符替换机制 |

### 帮助指令

| 指令 | 说明 | 用途 |
|------|------|------|
| `/newapi help <question>` | 提问关于 New API 的问题 | 获取 New API 部署、配置、API 调用格式等帮助信息 |

## 安装与配置

<Steps>
  <Step>
    ### 安装 newapi-skills

    使用 `npx` 一键安装：

    ```bash
    npx skills add https://github.com/QuantumNous/skills --skill newapi
    ```

    该命令会从 GitHub 仓库拉取最新的 Skill 定义并安装到你的编辑器环境。
  </Step>
  <Step>
    ### 设置环境变量

    newapi-skills 需要三个环境变量来连接你的 New API 实例。推荐在终端配置文件中设置：

    ```bash
    # ~/.bashrc 或 ~/.zshrc
    export NEWAPI_BASE_URL=https://<your-newapi-domain>
    export NEWAPI_ACCESS_TOKEN=your-access-token
    export NEWAPI_USER_ID=1
    ```

    | 变量 | 说明 | 示例 |
    |------|------|------|
    | `NEWAPI_BASE_URL` | New API 服务地址 | `https://api.example.com` |
    | `NEWAPI_ACCESS_TOKEN` | 管理员或用户的访问令牌 | 从「个人设置 → 账户管理 → 安全设置 → 系统访问令牌」获取 |
    | `NEWAPI_USER_ID` | 用户 ID | `1`（管理员默认为 1） |

    也可以在项目根目录创建 `.env` 文件。请确保 `.env` 已加入 `.gitignore`，防止密钥泄露。
  </Step>
  <Step>
    ### 开始使用

    安装完成后，在支持 Skills 的 AI 编辑器中直接输入 `/newapi` 指令即可。例如：

    - 输入 `/newapi models` 查看可用模型列表
    - 输入 `/newapi balance` 查看当前余额
    - 输入 `/newapi create-token my-app` 创建一个名为 `my-app` 的新令牌
    - 输入 `/newapi help 如何配置模型分组和令牌？` 直接提问 New API 的使用问题
    - 在 OpenClaw（龙虾）中同样可以直接调用 `/newapi models`、`/newapi balance` 等指令
  </Step>
</Steps>

## 运行环境要求

newapi-skills 需要以下任一 JavaScript 运行时（Skill 启动时自动检测）：

| 运行时 | 版本要求 | 推荐程度 |
|--------|---------|---------|
| **Bun** | 最新版 | 推荐（最快） |
| **Node.js** | >= 18 | 广泛支持 |
| **Deno** | 最新版 | 可选 |

## 安全机制

newapi-skills 内置多层安全防护，保护你的 API 密钥安全：

- 令牌列表仅显示**掩码密钥**（如 `sk-reHR**********OspA`），真实密钥不会出现在终端输出中
- `copy-token` 仅将密钥复制到系统剪贴板，不会在任何输出中显示
- `apply-token` 使用占位符替换机制注入密钥，不直接暴露密钥内容
- 所有 `sk-` 开头的密钥值在整个执行流程中都被严格保护

## 了解更多

newapi-skills 正在持续迭代中，指令和功能可能随版本更新。请以仓库 README 为准获取最新信息和变更日志：

- GitHub 仓库：[github.com/QuantumNous/skills](https://github.com/QuantumNous/skills)
- New API 官网：[www.newapi.ai](https://www.newapi.ai)
- New API GitHub：[github.com/QuantumNous/new-api](https://github.com/QuantumNous/new-api)
