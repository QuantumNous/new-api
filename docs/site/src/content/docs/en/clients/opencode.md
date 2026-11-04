---
title: OpenCode
description: Add an OpenAI-compatible provider and select a model.
---

Install OpenCode and [create an API key](/en/start/api-key/) first.

## Step 1: Set the key

Replace `sk-your-api-key` with your key:

```bash
export DP_API_KEY="sk-your-api-key"
```

## Step 2: Add the configuration

Merge the following into `opencode.json` at your project root, replacing every `your-model` with the same [available model ID](/en/start/models/):

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

`{env:DP_API_KEY}` reads the key from the environment variable; leave it as is. To add more models, add entries under `models`.

## Step 3: Verify the connection

In the same terminal, from your project directory, run:

```bash
opencode run "Hello"
```

After you get a reply, confirm the request in [Usage Logs](https://{{API_HOST}}/usage-logs/common).
