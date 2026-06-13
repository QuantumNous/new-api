# relay/ — Upstream LLM relay subsystem

This package converts incoming OpenAI/Claude/Gemini-shaped requests into provider-native API calls, streams responses back, and tallies token usage. It's the heart of the gateway.

For the architecture context (where `relay/` sits in the request pipeline), see [`../ARCHITECTURE.md`](../ARCHITECTURE.md). For the per-provider details, see [`channel/README.md`](./channel/README.md).

## Two kinds of files

```
relay/
├── *_handler.go              ← entry points called from controller/
│                                (one per request shape: chat, claude, gemini, image, audio, ...)
├── airbotix_policy.go        ← Airbotix fork-only: applies policy+kids enforcement before provider conversion
├── airbotix_policy_test.go
├── relay_adaptor.go          ← dispatcher: maps channel type → provider adapter
├── relay_task.go             ← async task path (Midjourney, video generation)
├── helper/, common/, common_handler/, constant/, reasonmap/   ← shared logic
└── channel/<provider>/       ← 37 provider adapters (see channel/README.md)
```

## Request lifecycle

```
1. controller/relay.go (or controller/relay-claude.go etc.)
       │ receives request, validates user, fetches channel
       ▼
2. relay/<shape>_handler.go
       │ shapes the request as RelayInfo + provider-agnostic DTO
       │ APPLIES relay/airbotix_policy.go IF tenant has kids_mode/profile
       ▼
3. relay/relay_adaptor.go:GetAdaptor(channelType)
       │ returns the right channel.Adaptor implementation
       ▼
4. relay/channel/<provider>/adaptor.go
       │ Init → ConvertOpenAIRequest (or ConvertClaude/Gemini/...)
       │ → SetupRequestHeader → DoRequest → DoResponse
       ▼
5. upstream LLM HTTP call (streaming or non-streaming)
       │
       ▼
6. response streams back → controller writes to client
       │ usage is tallied, quota deducted, log row written
       │ (Phase 2: billing.Dispatcher.Send fires here in a goroutine)
```

## The `channel.Adaptor` interface

Defined in `channel/adapter.go`. Every provider implements this:

```go
type Adaptor interface {
    Init(*relaycommon.RelayInfo)
    GetRequestURL(*relaycommon.RelayInfo) (string, error)
    SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error
    ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.GeneralOpenAIRequest) (any, error)
    ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error)
    ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.GeminiChatRequest) (any, error)
    ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.EmbeddingRequest) (any, error)
    ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ImageRequest) (any, error)
    ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.AudioRequest) (any, error)
    ConvertRerankRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.RerankRequest) (any, error)
    DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error)
    DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError)
    GetModelList() []string
    GetChannelName() string
}
```

Most adapters delegate `ConvertClaudeRequest` etc. to a "not implemented" stub if the provider only does OpenAI-shaped requests. The handler layer is responsible for choosing the right `Convert*` based on the incoming endpoint.

## Top-level handlers

Each file in `relay/` root handles one client-facing request shape:

| Handler | Endpoint(s) it serves | What it does |
|---|---|---|
| `chat_completions_via_responses.go` | `/v1/chat/completions` | Converts to OpenAI Responses format and delegates |
| `responses_handler.go` | `/v1/responses` | OpenAI Responses format native handler |
| `claude_handler.go` | `/v1/messages` | Anthropic Messages format native |
| `gemini_handler.go` | Gemini native paths | Google Gemini native shape |
| `embedding_handler.go` | `/v1/embeddings` | Embeddings dispatcher |
| `image_handler.go` | `/v1/images/generations` | Image generation |
| `audio_handler.go` | `/v1/audio/*` | STT + TTS |
| `rerank_handler.go` | rerank paths | Reranking service |
| `mjproxy_handler.go` | Midjourney proxy paths | Midjourney upstream |
| `websocket.go` | realtime WS | OpenAI Realtime / streaming WS |

Each handler:
1. Validates the typed request DTO.
2. Calls `airbotix_policy.Apply<Shape>(c, decision, req)` to enforce kids_mode/profile.
3. Calls `GetAdaptor(channelType)` and orchestrates the `Convert → SetupHeader → DoRequest → DoResponse` lifecycle.
4. Handles streaming/non-streaming response writing.
5. Reports usage back to the caller for quota/log accounting.

## `relay/airbotix_policy.go` (fork-specific)

This is the **one upstream-adjacent file** that contains Airbotix-specific logic. Named so rebase conflicts are obvious. It exposes one function per request shape:

```go
func ApplyOpenAIPolicy(c *gin.Context, decision policy.Decision, req *dto.GeneralOpenAIRequest) error
func ApplyClaudePolicy(c *gin.Context, decision policy.Decision, req *dto.ClaudeRequest) error
func ApplyGeminiPolicy(c *gin.Context, decision policy.Decision, req *dto.GeminiChatRequest) error
func ApplyResponsesPolicy(c *gin.Context, decision policy.Decision, req *dto.OpenAIResponsesRequest) error
```

Each function:
- Checks `decision.EnforceModelWhitelist` and returns a 400-equivalent error if the requested model isn't in `kids.EligibleModels`.
- Calls `kids.StripIdentifyingMetadata` if `decision.StripIdentifying`.
- Calls `kids.EnforceZeroDataRetention` if `decision.EnforceZDR` (no-op for non-OpenAI providers).
- Prepends the profile-level system prompt as a system message if `decision.InjectSystemPrompt`.

The handler calls these BEFORE `Convert*` so the policy operates on the gateway-native shape, not the provider-native one.

If you add a new request shape that needs kids_mode enforcement:
1. Add `Apply<NewShape>Policy(...)` here.
2. Call it from the new `relay/<shape>_handler.go`.
3. Add a test case to `airbotix_policy_test.go`.

## Adding kids_mode coverage to an existing shape

If a request shape (say image) doesn't currently apply policy and should:

1. Check `airbotix_policy.go` for an existing `Apply<Shape>Policy`.
2. If missing, add it (mirror the OpenAI version).
3. Call it from the relevant `<shape>_handler.go` just after the DTO is parsed.
4. Add test coverage for: whitelist rejection, metadata strip, prompt injection, ZDR.

## Cross-protocol conversion

Some pairings are non-trivial:

- OpenAI → Claude / Claude → OpenAI: tool_calls representation differs; image content blocks differ; system message location differs. The provider adapter's `ConvertOpenAIRequest` (in Claude) or `ConvertClaudeRequest` (in OpenAI) handles this.
- OpenAI ↔ Gemini: function calling representation differs; multi-part content differs.

Stream handling is **always** at the adapter's `DoResponse` level, parsing the provider's SSE / chunked format back into OpenAI-style `delta` chunks for the client.

## What this README does NOT cover

- Channel selection / health / weight tuning → `model/channel_cache.go` + `ARCHITECTURE.md` §"Two-layer routing".
- Pricing / quota tally → `service/quota.go` + `setting/ratio/`.
- Adding a new provider → [`channel/README.md`](./channel/README.md).
- Async tasks (MJ / video gen) → `relay_task.go` + `router/relay-router-task.go`.
