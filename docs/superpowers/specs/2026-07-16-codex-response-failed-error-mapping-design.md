# Codex `response.failed` Error Mapping Design

## Problem

The Codex channel always receives an upstream Responses API SSE stream, even when the downstream client requested Chat Completions or a non-streaming response. On current `main`, a terminal `response.failed` event is converted into a successful Chat Completions response:

- `response.created` immediately emits an assistant role chunk and can commit HTTP 200 before meaningful output exists.
- `response.failed` is converted to `finish_reason="content_filter"` and its error message is appended to assistant `content`.
- the bridge then emits a normal finish chunk and `[DONE]`.
- scanner errors or EOF without a successful terminal event are logged but finalized as `finish_reason="stop"`.
- after downstream bytes have been written, the controller can still retry or append a JSON error body to the SSE response.

LiteLLM therefore records the request as a successful HTTP 200 completion instead of an upstream failure.

## Evidence and Root Cause

The regression was introduced intentionally by commit `ebe6be413`, which made `response.failed` visible by embedding the upstream error message in assistant content. This preserves text visibility but changes the semantic category from API error to model output.

The failure is not limited to errors that occur after model output. Codex normally sends `response.created` first, and the converter currently emits a role chunk for that event. A subsequent immediate `response.failed` therefore arrives after the response has already been committed as a successful SSE stream.

LiteLLM recognizes an OpenAI-shaped first SSE error frame whose `error.code` is a numeric HTTP status, and converts it to a normal JSON error response. It also recognizes error objects in later streaming chunks. It cannot classify ordinary assistant content as an API failure.

## Goals

- Never encode a Codex upstream failure message as assistant content.
- Before meaningful downstream output, return a normal non-2xx OpenAI error response so LiteLLM can retry or classify the request correctly.
- After meaningful downstream output, preserve already delivered content and terminate with an OpenAI-shaped SSE error frame.
- Never emit a success finish chunk or `[DONE]` after a failed or truncated stream.
- Never retry after downstream bytes have been written.
- Preserve upstream HTTP non-2xx status mapping and successful stream behavior.
- Retain usage carried by failed terminal events in the adapter result while keeping the existing refund-on-error billing policy.

## Non-goals

- Changing the public Responses API relay path.
- Retrying a request after any downstream bytes were written.
- Charging users for failed requests; existing refund behavior remains unchanged.
- Refactoring unrelated streaming adapters or the controller retry policy beyond the response-commit invariant.

## Considered Approaches

### 1. Keep converting failures to Chat Completions content

This is the current behavior. It is portable for clients that only parse Chat Completions chunks, but it makes failures indistinguishable from model-generated text and prevents LiteLLM error handling. Rejected.

### 2. Special-case only the first `response.failed` event

This would map a failure when it is literally the first SSE event. It does not work for the normal Codex sequence because `response.created` precedes the failure and already commits HTTP 200. Rejected.

### 3. Two-phase downstream commit with explicit failed terminal handling

Buffer protocol prelude chunks until meaningful output or successful completion. Treat failed and missing terminal states as errors, with different downstream behavior before and after response commitment. This fixes both immediate and mid-stream failures while preserving normal streaming semantics. Selected.

## Design

### 1. Protocol-level error classification

`pkg/apicompat` remains responsible for Responses/Chat structural conversion, but it must not place upstream error text in `delta.content`. The Codex bridge owns the decision to return an HTTP error or an SSE error because only the bridge knows whether downstream output has been committed.

For `response.failed`:

- capture `response.error.message`, falling back to `response.error.code`, then to a generic upstream-failure message;
- capture `response.usage` when present;
- create a `types.NewAPIError` with HTTP 500 and the existing bad-response error category;
- do not pass the event through the normal success finalizer.

An actual upstream HTTP non-2xx response continues to preserve its original status code. Transport/protocol termination without a successful terminal event uses HTTP 502.

### 2. Two-phase streaming commit

The bridge keeps generated prelude chunks, currently the role chunk from `response.created`, in memory.

- `response.created`: update conversion state and buffer its role chunk; do not write it.
- first meaningful text, reasoning, or tool-call output: flush the buffered role chunk, then write the meaningful chunks.
- successful terminal event with no prior meaningful output: flush the buffered role chunk, then write normal finish/usage chunks and `[DONE]`.
- failed terminal event before meaningful output: discard the buffered role chunk and return the `NewAPIError`. Since no body was written, the controller returns a normal HTTP 500 OpenAI error JSON and may follow the existing safe retry policy.
- failed terminal event after meaningful output: write one OpenAI-shaped SSE error frame, return the same error with `ErrOptionWithSkipRetry`, and emit neither a finish chunk nor `[DONE]`.

The late error frame has this shape so LiteLLM can parse the numeric status:

```text
data: {"error":{"message":"<upstream failure>","type":"upstream_error","param":"","code":"500"}}

```

### 3. Terminal-state validation

The bridge tracks whether a successful terminal event (`response.completed`, `response.done`, or the existing non-error `response.incomplete` semantics) was seen.

- scanner error: return a protocol/upstream error instead of normal finalization;
- EOF with no terminal event: return a protocol/upstream error instead of synthesizing `finish_reason="stop"`;
- failed terminal event: follow the early/late failure paths above;
- successful terminal event: retain current finish-reason and usage behavior.

`response.incomplete` remains a valid terminal completion because it carries normal Chat Completions semantics such as `finish_reason="length"`; it is not treated as a transport failure.

### 4. Non-streaming client behavior

The upstream SSE stream is fully accumulated before any downstream body is written.

- successful terminal event: build the current HTTP 200 Chat Completions JSON response;
- `response.failed`: return HTTP 500 with an OpenAI error object, never a Chat Completions assistant message;
- scanner error or EOF without a terminal event: return HTTP 502 with an OpenAI error object;
- failed-event usage remains returned by the adapter alongside the error for accounting visibility, while the caller's existing error path refunds the request.

### 5. Response-commit guard

The relay controller enforces a generic HTTP invariant:

- `shouldRetry` returns false when `c.Writer.Written()` is true;
- the deferred error renderer does not append a JSON error body when the response body is already committed.

This guard is not Codex-specific: retrying or changing response format after bytes have reached a client is invalid for every streaming provider. The Codex adapter still marks late failures with `ErrOptionWithSkipRetry` as defense in depth.

## Data Flow

| Upstream sequence | Downstream result |
| --- | --- |
| HTTP non-2xx | Same non-2xx status through existing error mapping |
| `created -> failed` | HTTP 500 OpenAI error JSON; no role/content chunk |
| `created -> text delta -> failed` | Existing role/text chunks, then SSE error frame; no finish or `[DONE]` |
| `created -> EOF` | HTTP 502 before output, or SSE error after output |
| `created -> completed` | Existing successful Chat Completions stream/JSON |
| `created -> incomplete(max_output_tokens)` | Existing successful completion with `finish_reason="length"` |

## Regression Tests

### Codex bridge

1. Streaming `response.created -> response.failed`:
   - response status is non-2xx OpenAI JSON when invoked through the relay boundary;
   - no role or assistant content is written first;
   - no success finish chunk and no `[DONE]`.
2. Streaming text delta followed by `response.failed`:
   - role and partial text are preserved;
   - error text is not present in assistant content;
   - an OpenAI-shaped SSE error frame with numeric code is emitted;
   - no success finish chunk and no `[DONE]`;
   - returned error is marked skip-retry.
3. Non-streaming immediate `response.failed`:
   - returns a non-2xx error;
   - writes no Chat Completions response body.
4. Upstream HTTP non-2xx:
   - preserves the upstream status code.
5. Scanner error or EOF before a terminal event:
   - returns failure instead of synthetic `stop`;
   - uses the early/late downstream split.
6. Successful streaming and non-streaming responses:
   - retain role/content/finish/usage behavior.
7. Failed terminal event with usage:
   - returns the captured prompt/completion/total token values alongside the error.

### API compatibility conversion

8. `response.failed` conversion:
   - never emits upstream error text as `delta.content`;
   - retains usage in converter state when called directly.

### Relay controller

9. Retry decision after response commitment:
   - `shouldRetry` is false after any downstream write.
10. Deferred error rendering after response commitment:
    - does not append a JSON error object to an existing SSE body.

## Validation

- Run the new focused tests once before implementation and confirm they fail for the expected semantic reason.
- Run focused Codex, apicompat, and controller tests after each minimal fix.
- Run `go test ./relay/channel/codex/...`, `go test ./pkg/apicompat/...`, and targeted controller tests.
- Run `go test ./relay/...` and `go build ./...` before completion.
- Record the pre-existing unrelated controller failure `TestStripeCheckoutSessionEmbeddedModeUsesReturnURL` separately if it remains reproducible.

## Deployment Impact

- Router deploy: required. The change affects `/v1/chat/completions`, streaming behavior, provider error classification, retries, and billing refund paths.
- Other deploy targets: staging should be validated first; no website, Terraform, Cloudflare, or database migration is involved.
- Multi-node behavior: not relevant to correctness because all state is request-local and no cross-instance coordination is introduced.
