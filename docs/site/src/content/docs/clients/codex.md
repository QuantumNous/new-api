---
title: Codex CLI
description: 配置 Codex 命令行的 DeepPattern API 供应商，通过 Responses API 使用模型。
---

已安装 Codex CLI 并[创建 API Key](/start/api-key/)后，按以下步骤配置。也可使用 [CC Switch](/clients/cc-switch/) 一键导入。

使用合并后的桌面应用，请查看 [ChatGPT(Codex) 桌面端](/clients/chatgpt-codex/)。桌面端通过应用保存 API 密钥，不依赖此处终端会话的环境变量。

## 第 1 步：设置密钥

将 `sk-your-api-key` 替换为你的密钥：

```bash
export DP_API_KEY="sk-your-api-key"
```

## 第 2 步：配置供应商

编辑 `~/.codex/config.toml`，合并以下配置；已有同名字段时直接更新。将 `your-model` 替换为支持 Responses 的[可用模型](/start/models/)。

```toml
model_provider = "deeppattern"
model = "your-model"

[model_providers.deeppattern]
name = "DeepPattern API"
base_url = "https://{{API_HOST}}/v1"
env_key = "DP_API_KEY"
wire_api = "responses"
```

`env_key` 填环境变量名，不填密钥。Codex 仅支持 `responses`，不要改为 `chat`。

## 第 3 步：验证接入

在同一终端的项目目录中运行：

```bash
codex exec "Hello"
```

收到回复后，在[使用日志](https://{{API_HOST}}/usage-logs/common)确认本次请求。

仅支持 Chat Completions 的模型请使用 [OpenCode](/clients/opencode/) 或 [OpenAI SDK](/clients/sdk/)。完整配置项见 [Codex 官方文档](https://developers.openai.com/codex/config-reference/)。
