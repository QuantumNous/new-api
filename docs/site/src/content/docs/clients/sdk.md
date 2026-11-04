---
title: OpenAI 与 Anthropic SDK
description: 使用官方 Python 或 Node.js SDK 调用 DeepPattern API。
---

## 准备密钥和模型

先[创建 API Key](/start/api-key/)，将 `sk-your-api-key` 替换为你的密钥：

```bash
export DP_API_KEY="sk-your-api-key"
```

将示例中的 `your-model` 替换为支持对应协议的[可用模型 ID](/start/models/)。

## OpenAI SDK

### Python

安装：`pip install openai`。以下示例使用 Responses API：

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://{{API_HOST}}/v1",
    api_key=os.environ["DP_API_KEY"],
)
response = client.responses.create(model="your-model", input="Hello")
print(response.output_text)
```

### Node.js

安装：`npm install openai`。以下示例使用 Chat Completions API：

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://{{API_HOST}}/v1',
  apiKey: process.env.DP_API_KEY,
});
const response = await client.chat.completions.create({
  model: 'your-model',
  messages: [{ role: 'user', content: 'Hello' }],
});
console.log(response.choices[0]?.message.content);
```

## Anthropic SDK

Base URL 不包含 `/v1`，SDK 会自动添加 `/v1/messages`。

### Python

安装：`pip install anthropic`。

```python
import os
from anthropic import Anthropic

client = Anthropic(
    base_url="https://{{API_HOST}}",
    api_key=os.environ["DP_API_KEY"],
)
message = client.messages.create(
    model="your-model",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
print(message.content)
```

### Node.js

安装：`npm install @anthropic-ai/sdk`。

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: 'https://{{API_HOST}}',
  apiKey: process.env.DP_API_KEY,
});
const message = await client.messages.create({
  model: 'your-model',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
});
console.log(message.content);
```

运行后应输出模型回复。请求明细见[使用日志](https://{{API_HOST}}/usage-logs/common)，流式调用见[流式输出](/guides/streaming/)。
