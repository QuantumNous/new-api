---
title: OpenCode
description: 添加 OpenAI 兼容供应商并选择模型。
---

先安装 OpenCode 并[创建 API Key](/start/api-key/)。

## 第 1 步：设置密钥

将 `sk-your-api-key` 替换为你的密钥：

```bash
export DP_API_KEY="sk-your-api-key"
```

## 第 2 步：添加配置

在项目根目录的 `opencode.json` 中合并以下配置，将所有 `your-model` 替换为同一个[可用模型 ID](/start/models/)：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "deeppattern/your-model",
  "provider": {
    "deeppattern": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepPattern API",
      "options": {
        "baseURL": "https://{{API_HOST}}/v1",
        "apiKey": "{env:DP_API_KEY}"
      },
      "models": {
        "your-model": {
          "name": "your-model"
        }
      }
    }
  }
}
```

`{env:DP_API_KEY}` 从环境变量读取密钥，无需改写。添加其他模型时，在 `models` 中增加对应条目。

## 第 3 步：验证接入

在同一终端的项目目录中运行：

```bash
opencode run "Hello"
```

收到回复后，在[使用日志](https://{{API_HOST}}/usage-logs/common)确认本次请求。
