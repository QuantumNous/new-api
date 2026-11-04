---
title: OpenAI and Anthropic SDKs
description: Call DeepPattern API with the official Python or Node.js SDKs.
---

## Prepare a key and model

First [create an API key](/en/start/api-key/), then replace `sk-your-api-key` with your key:

```bash
export DP_API_KEY="sk-your-api-key"
```

Replace `your-model` in the examples with an [available model ID](/en/start/models/) that supports the corresponding protocol.

## OpenAI SDK

### Python

Install: `pip install openai`. This example uses the Responses API:

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

Install: `npm install openai`. This example uses the Chat Completions API:

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

The base URL doesn't include `/v1`; the SDK appends `/v1/messages` automatically.

### Python

Install: `pip install anthropic`.

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

Install: `npm install @anthropic-ai/sdk`.

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

The output should be the model's reply. For request details, see [Usage Logs](https://{{API_HOST}}/usage-logs/common). For streaming calls, see [Streaming](/en/guides/streaming/).
