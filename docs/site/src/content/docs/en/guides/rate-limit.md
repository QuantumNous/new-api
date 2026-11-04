---
title: Rate Limits and Retries
description: Recognize 429 responses and configure bounded retries.
---

## Handling a 429

| Response | What to do |
|---|---|
| Includes `Retry-After` | Wait the number of seconds in the header, then retry |
| Body states the request window and limit | Reduce concurrency and wait for the window to reset |
| Says failed requests are counted | Fix the failing requests first so they stop consuming your request quota |

Rate limits may apply per egress IP or per account. Other clients behind the same egress IP can also affect your quota.

## Retry strategy

1. Retry only `429` and transient `5xx` errors, with a limit; fix the request for other `4xx` errors.
2. Honor `Retry-After` when present; otherwise use exponential backoff with random jitter.
3. Set a maximum retry count and a total timeout to avoid retrying indefinitely.
4. Interrupted streaming responses cannot be resumed; retrying may incur additional cost.

If you keep hitting rate limits, reduce concurrency or ask your administrator to raise the limit. For other errors, see [Error codes](/en/api/relay/#general/guide/errors).
