---
title: Billing and Usage
description: View request usage and verify model prices and costs.
---

## Billing rules

Models may be billed per token, per request, per image, or per video. Prices depend on the model and service group; see the [Model Square](https://{{API_HOST}}/pricing) and the current billing configuration.

Each API key can have its own spending limit. Account balances do not expire.

## Verify a request's cost

1. Open [Usage Logs](https://{{API_HOST}}/usage-logs/common).
2. Find the record by request time, key, and model.
3. Check input, output, and cache tokens, or billed units such as images or videos.
4. Verify the cost against the billing rules for the model's group; do not apply the provider's official prices directly.

For OpenAI Chat Completions, usage is in the response's `usage` field. Streaming requests must set `stream_options.include_usage`; see [Streaming](/en/guides/streaming/).

## FAQ

- **Cost differs from what you expected**: check the service group, billing method, input and output unit prices, and cache usage.
- **Are failed requests billed?** Failed requests that never reached the upstream are not billed; requests interrupted after producing output are billed for actual usage.
- **Insufficient quota**: check your account balance and the key's remaining quota. If you have a redemption code, add credit by following [Redeem a code](/en/start/redeem/); a key's spending limit must be adjusted separately.
