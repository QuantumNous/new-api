# GPT API 接口概述

61kj 提供 OpenAI 兼容的 GPT 接口调用方式。

## Base URL

统一使用下面的 GPT 接口地址：

```text
http://61kj.top/v1
```

## 认证方式

所有 GPT 接口统一使用 Bearer Token：

```text
Authorization: Bearer sk-your-token-here
```

## 接口范围

| 接口 | 路径 | 用途 |
| --- | --- | --- |
| 模型列表 | `GET /v1/models` | 查询当前可用 GPT 模型 |
| 聊天补全 | `POST /v1/chat/completions` | 标准 GPT 对话、工具调用、流式输出 |
| Responses | `POST /v1/responses` | 更适合推理、结构化输出与复杂任务 |

## 请求格式

| 项目 | 说明 |
| --- | --- |
| 协议 | HTTPS |
| 请求头 | `Content-Type: application/json` 与 `Authorization: Bearer ...` |
| 请求方式 | `GET` / `POST` |
| 响应格式 | JSON / SSE（流式） |

## 模型列表查询

```bash
curl http://61kj.top/v1/models \
  -H "Authorization: Bearer sk-your-token-here"
```

<div class="callout info">
  <div class="callout-icon">ℹ️</div>
  <div class="callout-content">
    <p><strong>提示：</strong>请始终以 <code>GET /v1/models</code> 的返回结果为准，确认你当前令牌真正可用的 GPT 模型。</p>
  </div>
</div>
