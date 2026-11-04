---
title: 快速接入
description: 选择模型、发送第一条 API 请求，并核对本次调用费用。
---

以下使用 `gpt-5.6-luna` 完成一次文本对话。命令适用于 macOS / Linux 终端；如需配置客户端，直接查看 [CC Switch](/clients/cc-switch/)。

## 第 1 步：准备 API Key

确认[钱包](https://{{API_HOST}}/wallet)有可用额度，按[创建 API Key](/start/api-key/)教程创建 `ChatGPT` 分组的密钥，在列表中选择 **`···` → 复制密钥**。

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/key-copy.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/key-copy.webp" alt="在 API 密钥操作菜单中复制完整密钥" width="1600" height="430" loading="lazy" />
  </a>
  <figcaption>复制完整密钥，不要手动复制带星号的隐藏文本。</figcaption>
</figure>

## 第 2 步：确认模型和接口

打开[模型广场](https://{{API_HOST}}/pricing)，搜索 `gpt-5.6-luna`。进入模型详情，选择 **API → openai**，确认示例地址为 `/v1/chat/completions`。

本例使用：

| 参数 | 值 |
|---|---|
| 密钥分组 | `ChatGPT` |
| 模型 | `gpt-5.6-luna` |
| 请求地址 | `https://{{API_HOST}}/v1/chat/completions` |
| 客户端 Base URL | `https://{{API_HOST}}/v1` |

模型下线或更名时，请选择同样支持 `openai` 接口的文本模型，并同步修改下方 `model`。不要直接使用图片模型或只支持其他接口的模型。

## 第 3 步：发送请求

将 `sk-your-api-key` 替换为刚复制的完整密钥，再执行：

```bash
export DP_API_KEY="sk-your-api-key"

curl --fail-with-body https://{{API_HOST}}/v1/chat/completions \
  -H "Authorization: Bearer $DP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.6-luna",
    "messages": [{"role": "user", "content": "Reply with exactly: Hello"}],
    "max_completion_tokens": 1024
  }'
```

成功时返回 JSON，回复文本位于 `choices[0].message.content`。返回结构示例（省略其他字段）：

```json
{
  "choices": [
    {"message": {"role": "assistant", "content": "Hello"}}
  ]
}
```

## 第 4 步：核对调用记录

打开[使用日志](https://{{API_HOST}}/usage-logs/common)：

1. 选择包含本次请求的时间范围，类型选择 **消耗**。
2. 在 **模型名称** 中填写本次使用的模型；需要按密钥筛选时，展开并填写 **令牌名称**。
3. 点击 **搜索**，核对请求的模型、Tokens、费用和耗时。

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/usage-log.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/usage-log.webp" alt="通用日志：时间、模型、令牌名称和消耗类型筛选，以及请求的 Tokens、费用和耗时" width="1600" height="451" loading="lazy" />
  </a>
  <figcaption>日志界面与历史请求记录。实际模型和费用以你的调用结果为准。</figcaption>
</figure>

| 返回结果 | 先检查 |
|---|---|
| `401` | 密钥是否完整、有效且未禁用 |
| `403` / 无权限 | 密钥分组、模型限制和 IP 限制是否允许本次调用 |
| 余额或额度不足 | 账户余额和这把密钥的剩余额度 |
| 模型不可用 | 模型详情中的分组及接口是否匹配 |

请求成功后，可按 [SDK 教程](/clients/sdk/)接入程序。其他错误见 [API 错误码](/api/relay/#general/guide/errors)。
