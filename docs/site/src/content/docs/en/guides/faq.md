---
title: FAQ
description: Base URLs, model selection, and common error handling.
---

## What do I need to configure?

Set your API key, Base URL, and model ID. See the [Quickstart](/en/start/quickstart/).

| Client protocol | Base URL |
|---|---|
| OpenAI-compatible | `https://{{API_HOST}}/v1` |
| Anthropic-compatible | `https://{{API_HOST}}` |
| Gemini-compatible | `https://{{API_HOST}}/v1beta` |

## How do I set up CC Switch?

On the [API Keys](https://{{API_HOST}}/keys) page, open **`···` → CC Switch** on the key's row, choose the app and model, import, then enable it in CC Switch. See the [step-by-step guide](/en/clients/cc-switch/).

## How do I choose a model?

Check prices in the [Model Square](https://{{API_HOST}}/pricing), and query `/v1/models` to see which models your key can call. Use the returned model `id`, not a display name or your own abbreviation.

To switch models within the same protocol, change only `model`. If a call fails, check the key's group and the protocols the model supports.

## How do I verify costs?

Find the request in [Usage Logs](https://{{API_HOST}}/usage-logs/common) and compare its usage and cost against the group's prices. See [Billing and usage](/en/guides/billing/).

## What should I do when a request fails?

| Error | Check first |
|---|---|
| `401` | Whether the key is complete, valid, and not disabled |
| `403` | Key permissions and the IP allowlist |
| `404` / `model_not_found` | Request path, model ID, and group permissions |
| `429` | Request rate, concurrency, and rate-limit window |

For full details, see [Error codes](/en/api/relay/#general/guide/errors). For retry strategy, see [Rate limits and retries](/en/guides/rate-limit/).
