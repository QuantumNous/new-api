# OpenClaw - 自托管 AI 智能助手平台

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/apps/openclaw.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/apps/openclaw.mdx

## 页面大纲

  - 🌟 核心特性
    - 多渠道集成
    - 自托管与数据安全
    - 智能代理能力
  - 📦 接入前准备
    - 1. 安装 OpenClaw（macOS/Linux）
    - 2. 运行引导向导
    - 3. 检查 Gateway 与 Control UI
    - 4. 定位配置文件
  - 🚀 使用 New API 作为模型提供商
    - 接入思路
    - 推荐做法：用环境变量保存密钥
    - 关键配置说明
    - 验证是否接入成功
    - 常见问题

## 原文内容

---
title: OpenClaw - 自托管 AI 智能助手平台
description: OpenClaw 教程 — 安装 OpenClaw、对接 New API，快速搭建自托管 AI 助手。开源项目，支持 Telegram、Discord、WhatsApp 等多渠道集成。
---
<Callout type="info" title="项目介绍">
  OpenClaw 是一个开源、自托管的个人 AI
  助手平台，将消息应用连接到运行在你自己硬件上的 AI
  代理。专为开发者和高级用户设计，无需交出数据控制权即可拥有自主 AI 助手。

  - 官方主页：[https://openclaw.ai](https://openclaw.ai)
  - 项目文档：[https://docs.openclaw.ai](https://docs.openclaw.ai)
  - GitHub：[https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
</Callout>

OpenClaw 完全开源，你可以在 [OpenClaw 的 GitHub 仓库](https://github.com/openclaw/openclaw) 浏览源码、提交 Issue 或参与贡献。本教程涵盖安装、配置，以及将 OpenClaw 对接 New API 的完整步骤。

## 🌟 核心特性

### 多渠道集成

- **多渠道集成**：支持 Telegram、Discord、WhatsApp、iMessage 等多种消息渠道，也可通过插件扩展更多平台
- **单一网关**：通过一个 Gateway 进程统一管理所有渠道
- **语音支持**：支持 macOS/iOS/Android 语音交互
- **Canvas 界面**：可渲染交互式 Canvas 界面

### 自托管与数据安全

- **完全自托管**：运行在你自己的机器或服务器上
- **开源透明**：MIT 开源协议，代码完全透明
- **数据本地化**：上下文和技能存储在你的本地计算机，而非云端

### 智能代理能力

- **持续运行**：支持后台常驻运行，拥有持久记忆
- **计划任务**：支持 cron 定时任务
- **会话隔离**：按代理/工作区/发送者隔离会话
- **多代理路由**：支持多代理协同工作
- **工具调用**：原生支持工具调用和代码执行

## 📦 接入前准备

<Callout type="info" title="准备信息">
  - Node.js 22 或更高版本
  - 一个可用的 New API 地址（通常以 `/v1` 结尾）
  - 一个可用的 New API API Key
  - 请使用您自己部署的 New API，或确认服务方具备合法上游授权和合规义务的 New API 服务。不要将来源不明的 API 地址或密钥接入生产环境。
</Callout>

在开始接入 New API 之前，建议先按 OpenClaw 官方当前推荐流程把 Gateway 和 Control UI 跑起来。这样后续排查问题时，更容易区分是 OpenClaw 本身未启动，还是模型提供商配置有误。

### 1. 安装 OpenClaw（macOS/Linux）

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

其他安装方式可参考 OpenClaw 官方文档：[Getting Started](https://docs.openclaw.ai/start/getting-started)。

### 2. 运行引导向导

```bash
openclaw onboard --install-daemon
```

该向导会完成基础认证、Gateway 设置，以及可选的渠道初始化。这里的目标是先把 OpenClaw 跑起来，后面再把默认模型切到 New API。

### 3. 检查 Gateway 与 Control UI

```bash
openclaw gateway status
```

```bash
openclaw dashboard
```

如果浏览器能打开 Control UI，说明 OpenClaw 基础运行已经正常。这个阶段不需要先配置 Telegram、Discord、飞书等消息渠道。

### 4. 定位配置文件

OpenClaw 的配置文件通常位于 `~/.openclaw/openclaw.json`，你可以在引导向导生成的基础上继续修改。

<Callout type="tip" title="路径相关环境变量">
  如果你把 OpenClaw 跑在专用服务账号下，或希望自定义配置/状态目录，可以使用：

  - `OPENCLAW_HOME`
  - `OPENCLAW_STATE_DIR`
  - `OPENCLAW_CONFIG_PATH`

  详细说明见官方环境变量文档：[Environment Variables](https://docs.openclaw.ai/help/environment)。
</Callout>

## 🚀 使用 New API 作为模型提供商

OpenClaw 支持通过 `models.providers` 接入自定义或兼容 OpenAI 接口的模型网关。对于 New API，最常见的做法是把它作为一个自定义 provider 加进配置里，再把默认模型指向 `newapi/模型ID`。

### 接入思路

1. 在 `models.providers` 下声明一个 `newapi` provider
2. 将 `baseUrl` 指向你的 New API 地址，并确保包含 `/v1`
3. 将 `api` 设为 `openai-completions`
4. 在 `models` 中列出你希望 OpenClaw 使用的模型 ID
5. 在 `agents.defaults.model.primary` 中把默认模型切到 `newapi/...`

### 推荐做法：用环境变量保存密钥

先在当前 shell、服务环境，或 OpenClaw 可读取的 `.env` 中提供你的 New API 密钥：

```bash
export NEWAPI_API_KEY="sk-your-newapi-key"
```

然后在 `openclaw.json` 里补充或修改以下片段：

```json5
{
  models: {
    mode: "merge",
    providers: {
      newapi: {
        baseUrl: "https://<your-newapi-domain>/v1",
        apiKey: "${NEWAPI_API_KEY}",
        api: "openai-completions",
        models: [
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
          { id: "kimi-k2.5", name: "Kimi K2.5" },
        ],
      },
    },
  },

  agents: {
    defaults: {
      model: {
        primary: "newapi/gemini-2.5-flash",
        fallbacks: ["newapi/kimi-k2.5"],
      },
      models: {
        "newapi/gemini-2.5-flash": { alias: "flash" },
        "newapi/kimi-k2.5": { alias: "kimi" },
      },
    },
  },
}
```

这不是一份必须原样照抄的完整配置，而是接入 New API 最关键的部分。只要 `provider`、模型 ID 和默认模型引用对应正确，OpenClaw 就能通过 New API 调用你暴露出来的模型资源。

### 关键配置说明

| 配置项 | 说明 |
| --- | --- |
| `models.mode` | 建议设为 `merge`，在保留 OpenClaw 内置 provider 的同时追加 `newapi` |
| `models.providers.newapi.baseUrl` | 你的 New API 地址，通常需要带上 `/v1` |
| `models.providers.newapi.apiKey` | New API 密钥，推荐通过 `${NEWAPI_API_KEY}` 注入 |
| `models.providers.newapi.api` | 对于 New API 这类 OpenAI 兼容网关，使用 `openai-completions` |
| `models.providers.newapi.models` | 这里列出的模型 ID 必须与你的 New API 实际暴露的模型名称一致 |
| `agents.defaults.model.primary` | 默认主模型，格式必须是 `provider/model-id` |
| `agents.defaults.model.fallbacks` | 备选模型列表，主模型失败时自动切换 |
| `agents.defaults.models` | 可选，用来给模型起别名，方便在 UI 或会话里引用 |

### 验证是否接入成功

完成配置后，回到 Control UI 或重新打开：

```bash
openclaw dashboard
```

如果你能在 OpenClaw 中正常发起对话，并且默认模型已经变成 `newapi/...`，说明接入成功。你也可以使用：

```bash
openclaw models list
```

确认 `newapi/` 前缀的模型已经出现在可选列表中。

### 常见问题

- `baseUrl` 没带 `/v1`：这是最常见的接入错误之一。
- 模型 ID 填错：`primary` 和 `fallbacks` 必须与 `models.providers.newapi.models` 里的 `id` 对应。
- 密钥只在当前终端生效：如果 Gateway 以后台服务运行，请确保服务进程也能读取 `NEWAPI_API_KEY`。
- 想前台排障：可使用官方前台运行方式 `openclaw gateway --port 18789` 观察日志与报错。
