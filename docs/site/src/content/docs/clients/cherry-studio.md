---
title: Cherry Studio
description: 添加 DeepPattern API 服务商并开始对话。
---

先[创建 API Key](/start/api-key/)，并确认[可用模型 ID](/start/models/)。

## 第 1 步：添加服务商

打开 **设置 → 模型服务**，新增服务商：

| 配置项 | 值 |
|---|---|
| 名称 | `DeepPattern API` |
| 类型 | `OpenAI` 或 `OpenAI 兼容` |
| API 地址 | `https://{{API_HOST}}/v1` |
| API 密钥 | 你的 API Key |

## 第 2 步：添加模型

在该服务商下添加模型，填写模型 ID，保存并启用服务商。无法自动获取模型列表时，手动填写模型 ID。

## 第 3 步：验证接入

新建会话，选择刚添加的模型并发送 `Hello`。收到回复后，在[使用日志](https://{{API_HOST}}/usage-logs/common)确认本次请求。

若错误路径出现 `/v1/v1`，将 API 地址改为 `https://{{API_HOST}}`；该版本客户端会自动添加 `/v1`。
