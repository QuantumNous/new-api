---
title: Cursor 与 Cline
description: 使用 OpenAI 兼容接口配置 Cursor 和 Cline。
---

先[创建 API Key](/start/api-key/)，并确认[可用模型 ID](/start/models/)。

## Cursor

1. 打开 **Settings → Models**，填写 **OpenAI API Key**。
2. 启用 **Override OpenAI Base URL**，填入 `https://{{API_HOST}}/v1`。
3. 添加模型 ID，验证连接后在会话中选择该模型。

自定义 API Key 不适用于 Cursor 的所有功能。

## Cline

打开 Cline 设置，填写以下配置并保存：

| 配置项 | 值 |
|---|---|
| API Provider | `OpenAI Compatible` |
| Base URL | `https://{{API_HOST}}/v1` |
| API Key | 你的 API Key |
| Model ID | 密钥可调用的模型 ID |

## 验证接入

新建会话并发送 `Hello`。收到回复后，在[使用日志](https://{{API_HOST}}/usage-logs/common)确认本次请求。

需要工具调用时，选择支持 function calling 的模型。请求失败时查看[错误码](/api/relay/#general/guide/errors)。
