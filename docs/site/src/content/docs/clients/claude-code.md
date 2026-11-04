---
title: Claude Code
description: 设置 API 地址、密钥和模型，接入 Claude Code。
---

先按 [Claude Code 官方安装指南](https://code.claude.com/docs/en/setup#install-claude-code) 安装，再[创建 API Key](/start/api-key/)。图形化配置可使用 [CC Switch](/clients/cc-switch/)。

如果国内打不开或下载慢，可尝试 [镜像源一键安装](/clients/downloads/#claude-cli-一键安装)。

## 第 1 步：设置环境变量

将 `sk-your-api-key` 替换为你的密钥，`your-model` 替换为支持 Anthropic 协议的[可用模型](/start/models/)：

```bash
export ANTHROPIC_BASE_URL="https://{{API_HOST}}"
export ANTHROPIC_AUTH_TOKEN="sk-your-api-key"
export ANTHROPIC_MODEL="your-model"
```

Base URL 不要添加 `/v1`，Claude Code 会自动拼接请求路径。

## 第 2 步：验证接入

在同一终端中运行：

```bash
claude -p "Hello"
```

收到回复后，在[使用日志](https://{{API_HOST}}/usage-logs/common)确认本次请求。

环境变量仅对当前终端及其子进程有效。需要保存或切换配置时，使用 [CC Switch](/clients/cc-switch/)。请求失败时查看[错误码](/api/relay/#general/guide/errors)。
