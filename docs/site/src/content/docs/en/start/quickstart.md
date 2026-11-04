---
title: Quickstart
description: Pick a model, send your first API request, and verify its cost.
---

This guide runs a text chat with `gpt-5.6-luna`. The commands are for a macOS / Linux terminal. To configure a client instead, go straight to [CC Switch](/en/clients/cc-switch/).

## Step 1: Get an API key

Make sure your [Wallet](https://{{API_HOST}}/wallet) has available credit, create a key in the `ChatGPT` group by following [Create an API key](/en/start/api-key/), and choose **`···` → Copy key** in the list.

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/key-copy.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/key-copy.webp" alt="Copy the full key from the API key actions menu" width="1600" height="430" loading="lazy" />
  </a>
  <figcaption>Copy the full key; do not manually copy the masked text.</figcaption>
</figure>

## Step 2: Confirm the model and endpoint

Open the [Model Square](https://{{API_HOST}}/pricing) and search for `gpt-5.6-luna`. Open the model details, select **API → openai**, and confirm the example path is `/v1/chat/completions`.

This example uses:

| Parameter | Value |
|---|---|
| Key group | `ChatGPT` |
| Model | `gpt-5.6-luna` |
| Request URL | `https://{{API_HOST}}/v1/chat/completions` |
| Client Base URL | `https://{{API_HOST}}/v1` |

If the model is retired or renamed, pick another text model that supports the `openai` endpoint and update `model` below. Do not use an image model or a model that only supports other endpoints.

## Step 3: Send a request

Replace `sk-your-api-key` with the full key you copied, then run:

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

On success, the response is JSON and the reply text is in `choices[0].message.content`. Example response (other fields omitted):

```json
{
  "choices": [
    {"message": {"role": "assistant", "content": "Hello"}}
  ]
}
```

## Step 4: Check the request log

Open [Usage Logs](https://{{API_HOST}}/usage-logs/common):

1. Select a time range that includes your request and set the type to **Consumption**.
2. Enter the model you used in **Model name**. To filter by key, expand the filters and enter the **Key name**.
3. Click **Search** and check the request's model, tokens, cost, and latency.

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/usage-log.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/usage-log.webp" alt="Usage logs: filters for time, model, key name, and consumption type, plus each request's tokens, cost, and latency" width="1600" height="451" loading="lazy" />
  </a>
  <figcaption>Log view with past requests. Your actual models and costs depend on your own requests.</figcaption>
</figure>

| Result | Check first |
|---|---|
| `401` | Whether the key is complete, valid, and not disabled |
| `403` / no permission | Whether the key's group, model restrictions, and IP restrictions allow the request |
| Insufficient balance or quota | Your account balance and this key's remaining quota |
| Model unavailable | Whether the group and endpoint match the model details |

Once your request succeeds, integrate it into your code with the [SDK guide](/en/clients/sdk/). For other errors, see [API error codes](/en/api/relay/#general/guide/errors).
