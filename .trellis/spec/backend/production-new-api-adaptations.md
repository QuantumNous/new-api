# Production New API Adaptations

## 1. Scope / Trigger

Apply this specification when changing the production retry proxy, the
`/v1/responses` streaming path, channel parameter compatibility, process file
limits, or proxy concurrency on branch `custom/production-20260719`.

## 2. Signatures

```bash
python3 deploy/retry-proxy/gpt56_retry_proxy.py \
  --listen 0.0.0.0:3000 \
  --upstream http://127.0.0.1:3001 \
  --attempts 5 \
  --upstream-concurrency 800
```

```ini
[Service]
LimitNOFILE=65536:65536
```

## 3. Contracts

- Retry HTTP `500`, `502`, `503`, and `504` only before downstream output is
  committed.
- For non-streaming Responses requests, retry a 200 body containing
  `response.failed` or a structured `error` event.
- For streaming Responses requests, hold `response.created`,
  `response.in_progress`, comments, and keep-alives before visible output.
- Retry when `response.failed` or a structured error arrives during that
  pre-output window.
- Send headers and buffered events only when the first effective output event
  arrives, EOF is reached, or the 64 KiB safety limit is reached.
- Never replay a request after any buffered or visible bytes have been sent to
  the client.
- Forward `/v1/messages` without Responses conversion.
- Forward `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, and `HEAD`.

## 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| HTTP 500/502/503/504 before commit | Retry up to five attempts |
| Streaming `response.failed` before output | Discard prelude and retry |
| Streaming failure after output | Do not replay; preserve the existing stream |
| Prelude reaches 64 KiB | Commit once and continue streaming; do not buffer further |
| HTTP 400 validation error | Correct model-scoped parameters; do not retry unchanged input |
| HTTP 401/402 | Correct credentials or balance; do not classify as transient |
| HTTP 501 admin mutation | Verify all HTTP forwarding methods are present |

## 5. Good / Base / Bad Cases

- Good: `response.created -> response.failed` is hidden, retried, and only the
  successful attempt reaches the client.
- Base: `response.created -> response.output_text.delta` is emitted once and
  the rest of the stream is copied byte-for-byte.
- Bad: send streaming headers immediately after upstream HTTP 200 and then try
  to replay after `response.failed`.

## 6. Tests Required

```bash
python3 -m py_compile deploy/retry-proxy/gpt56_retry_proxy.py
python3 -m unittest discover -s deploy/tests -v
systemd-analyze verify deploy/systemd/gpt56-retry-proxy.service
git diff --check
```

Required assertions:

- early `response.failed` performs a bounded retry and does not leak failed
  prelude events;
- the first successful output commits exactly once;
- a failure after visible output does not trigger replay;
- the prelude reader never returns more than its configured byte budget;
- the systemd unit applies concurrency 800 and `LimitNOFILE=65536`.

## 7. Wrong vs Correct

```text
Wrong: upstream 200 -> send headers -> forward response.created -> receive response.failed
Correct: upstream 200 -> buffer pre-output SSE -> retry early failure -> commit on effective output
```
