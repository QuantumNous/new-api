---
title: 常见问题
description: 接入地址、模型选择和常见错误处理。
---

## 接入需要哪些配置？

填写 API Key、Base URL 和模型 ID，详见[快速接入](/start/quickstart/)。

| 客户端协议 | Base URL |
|---|---|
| OpenAI 兼容 | `https://{{API_HOST}}/v1` |
| Anthropic 兼容 | `https://{{API_HOST}}` |
| Gemini 兼容 | `https://{{API_HOST}}/v1beta` |

## 如何配置 CC Switch？

在[API 密钥](https://{{API_HOST}}/keys)页面打开密钥行的 **`···` → CC Switch**，选择应用和模型后导入，再在 CC Switch 中启用。详见[图文教程](/clients/cc-switch/)。

## 如何选择模型？

在[模型广场](https://{{API_HOST}}/pricing)查看价格，通过 `/v1/models` 查询密钥可调用的模型。填写返回的模型 `id`，不要使用显示名称或自行缩写。

同一协议下切换模型，只需修改 `model`。无法调用时，检查密钥所属分组和模型支持的协议。

## 如何核对费用？

在[使用日志](https://{{API_HOST}}/usage-logs/common)中查找请求，对照分组价格核对用量和费用。详见[计费与用量核对](/guides/billing/)。

## 请求报错怎么办？

| 错误 | 优先检查 |
|---|---|
| `401` | 密钥是否完整、有效且未被禁用 |
| `403` | 密钥权限及 IP 允许列表 |
| `404` / `model_not_found` | 请求路径、模型 ID 和分组权限 |
| `429` | 请求频率、并发数和限流窗口 |

完整说明见[错误码](/api/relay/#general/guide/errors)，重试策略见[限流与重试](/guides/rate-limit/)。
