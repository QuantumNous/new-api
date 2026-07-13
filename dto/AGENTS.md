# dto/ — Data Transfer Objects

## Overview
29 files defining request/response structs for relay (OpenAI, Claude, Gemini), billing, video, and task APIs. DTOs are the wire format contract between client → gateway → upstream provider.

## Where to Look
| Task | Location | Notes |
|---|---|---|
| OpenAI request format | `openai_request.go` (1069 lines) | Largest DTO file — chat, completion, embedding, rerank, audio |
| OpenAI response format | `openai_response.go` | Streaming + non-streaming |
| Claude request/response | `claude_*.go` | Anthropic Messages API format |
| Gemini request/response | `gemini_*.go` | Google GenerativeLanguage format |
| Realtime API | `realtime_*.go` | WebSocket-based realtime sessions |
| Video generation | `video_*.go` | Sora, Kling, Runway, etc. |
| Billing display | `billing_*.go` | Log display, settlement DTOs |

## Conventions
- **Rule 6 (CRITICAL)**: Optional scalar fields in upstream relay request DTOs MUST use pointer types (`*int`, `*uint`, `*float64`, `*bool`) with `omitempty`. Non-pointer scalars with `omitempty` silently drop zero values during marshal. See `openai_request.go` for canonical examples.
- All JSON operations use `common.Marshal`/`common.Unmarshal` (Rule 1) — NOT `encoding/json` directly.
- DTOs for relay path are parsed from client JSON, potentially modified, then re-marshaled to upstream — preserve round-trip fidelity.
- Use `json.RawMessage` for pass-through fields where the gateway should not parse the content.

## Anti-Patterns
- **NEVER use non-pointer scalars with `omitempty`** for optional relay request fields (Rule 6). Zero values (`0`, `false`) will be silently dropped.
- Do NOT call `encoding/json` directly — use `common.*` wrappers (Rule 1).
- Do NOT add DTO fields without `omitempty` unless they are always required.

## Testing
- `openai_request_zero_value_test.go` — Enforces Rule 6 via round-trip tests. Uses `gjson.Exists()` to verify that explicit zero values on pointer fields survive marshal. When adding new optional fields, add corresponding test cases here.
