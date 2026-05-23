# How to add a new upstream LLM provider

A walkthrough for adding a new provider adapter to `relay/channel/`. The official reference is [`relay/channel/README.md`](../../relay/channel/README.md) §"Adding a new provider — procedure"; this file is the hands-on version with file paths, line ranges, and verification steps.

Estimated effort: **1 engineer-day** for an OpenAI-compatible provider; **2–4 days** for a provider with novel request shape or streaming format.

## Decision: is the provider OpenAI-compatible?

Most new providers in 2025–2026 ship an OpenAI-compatible endpoint. If yours does, you can implement the new channel as a thin shim over `relay/channel/openai/`:

```go
// relay/channel/<name>/adaptor.go
package <name>

import (
    openaiAdaptor "github.com/QuantumNous/new-api/relay/channel/openai"
    // ...
)

type Adaptor struct {
    openaiAdaptor.Adaptor // embed; override only what differs
}

func (a *Adaptor) GetChannelName() string { return ChannelName }
func (a *Adaptor) GetRequestURL(info *RelayInfo) (string, error) {
    return info.BaseUrl + "/v1/chat/completions", nil
}
func (a *Adaptor) GetModelList() []string { return ModelList }
```

If the provider has a unique request format (Anthropic / Gemini / Cohere style), you need the full adapter. Use `relay/channel/claude/` as the reference.

## Step-by-step (OpenAI-compatible case)

### 1. Pick a channel type integer

Open `constant/channel.go`. Find the largest `ChannelType*` constant and add the next integer:

```go
// constant/channel.go
const (
    // ... existing constants
    ChannelTypeXAI         = 47
    ChannelTypeNewProvider = 48  // ← add here, increment from the max
)
```

Also add the name → id mapping:

```go
var ChannelName2ChannelId = map[string]int{
    // ... existing
    "newprovider": ChannelTypeNewProvider,
}
```

### 2. Create the adapter directory

```bash
mkdir -p relay/channel/newprovider
```

Files to create:

```
relay/channel/newprovider/
├── adaptor.go         # implements channel.Adaptor (thin shim over openai)
├── constants.go       # ChannelName + ModelList
└── relay-newprovider.go    # only if novel request handling
```

Smallest viable `constants.go`:

```go
package newprovider

const ChannelName = "NewProvider"

var ModelList = []string{
    "newprovider-large",
    "newprovider-small",
    "newprovider-vision",
}
```

Smallest viable `adaptor.go` (OpenAI-compatible, no custom logic):

```go
package newprovider

import (
    "fmt"
    "io"
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/QuantumNous/new-api/dto"
    "github.com/QuantumNous/new-api/relay/channel/openai"
    relaycommon "github.com/QuantumNous/new-api/relay/common"
    "github.com/QuantumNous/new-api/types"
)

type Adaptor struct {
    openai.Adaptor
}

func (a *Adaptor) GetChannelName() string { return ChannelName }

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
    baseURL := info.BaseUrl
    if baseURL == "" {
        baseURL = "https://api.newprovider.example.com"
    }
    return fmt.Sprintf("%s/v1/chat/completions", baseURL), nil
}

func (a *Adaptor) GetModelList() []string { return ModelList }
```

### 3. Register in the dispatcher

Open `relay/relay_adaptor.go`. Add an import and a case to `GetAdaptor`:

```go
import (
    // ... existing
    "github.com/QuantumNous/new-api/relay/channel/newprovider"
)

func GetAdaptor(apiType int) channel.Adaptor {
    switch apiType {
    // ... existing cases
    case constant.APITypeNewProvider:
        return &newprovider.Adaptor{}
    }
    return nil
}
```

If you're using a new `APIType*` (rather than reusing `APITypeOpenAI`), declare it in `constant/api_type.go`. For OpenAI-compatible providers, you often **don't** need a new APIType — share `APITypeOpenAI` and rely on `ChannelType` to differentiate.

### 4. Add pricing

Open `setting/ratio/` (likely `model_ratio.go`). Add entries for each model in `ModelList`:

```go
"newprovider-large":  {2.5, 7.5, 0},  // input, output, image; per 1M tokens
"newprovider-small":  {0.5, 1.5, 0},
"newprovider-vision": {2.5, 7.5, 5.0},
```

Wrong pricing means wrong quota deductions. Double-check against the provider's official pricing page.

### 5. StreamOptions support

Open the file that defines `streamSupportedChannels` (likely in `service/` or `setting/`). If the new provider supports `stream_options: {include_usage: true}` (most modern OpenAI-compat providers do):

```go
var streamSupportedChannels = []int{
    // ... existing
    constant.ChannelTypeNewProvider,
}
```

This is [AGENTS.md Rule 4](../../AGENTS.md). Missing this causes streaming usage counts to be wrong → quota drift.

### 6. Test locally

```bash
# Build + restart
docker compose -f docker-compose.dev.yml up -d --build new-api

# Admin UI: Channels → Add new channel
# - Type: select NewProvider (should appear in the dropdown)
# - Name: newprovider-test
# - Base URL: https://api.newprovider.example.com (or leave empty to use the adapter default)
# - Key: <your test API key>
# - Models: newprovider-large, newprovider-small

# Then with a user API token:
TOKEN=sk-yourtoken
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"newprovider-large","messages":[{"role":"user","content":"Say hi"}]}'

# Streaming:
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"newprovider-large","stream":true,"messages":[{"role":"user","content":"Count to 3"}]}'

# With include_usage:
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"newprovider-large","stream":true,"stream_options":{"include_usage":true},"messages":[{"role":"user","content":"Count to 3"}]}'
# Last SSE chunk should have a "usage" field with prompt_tokens + completion_tokens.
```

If usage doesn't appear in the streaming last chunk, you forgot step 5.

### 7. Add tests

```
relay/channel/newprovider/
└── adaptor_test.go
```

Cover at minimum:
- `GetRequestURL` returns the expected URL for default and custom BaseURL
- `GetModelList` returns the expected list
- Non-streaming response parsing (usage extraction)
- Streaming chunk parsing (usage in last chunk if supported)

Look at `relay/channel/deepseek/` or `relay/channel/moonshot/` for OpenAI-compatible test references.

### 8. Frontend display (optional)

If you want a nicer label in the channel-add dropdown, search for the channel-type display map in `web/default/src/` (it's a JSON or TS file). Add an entry mapping `ChannelTypeNewProvider → "NewProvider (nice name)"`. Without this, the UI shows the raw const name.

## Step-by-step (novel request shape)

If the provider isn't OpenAI-compatible — for instance, Anthropic's `/v1/messages`, Gemini's `:generateContent`, or Cohere's `/v1/chat` — you need the full adapter. Reference: `relay/channel/claude/adaptor.go`.

Key files to add to your adapter directory:

- `dto.go` — provider-native request/response structs with JSON tags. Use `*` pointers for optional scalars to honour [AGENTS.md Rule 6](../../AGENTS.md).
- `relay-newprovider.go` — implements `ConvertOpenAIRequest` (translate from `dto.GeneralOpenAIRequest` to your `dto.go` struct) and the streaming parser. The streaming parser must convert the provider's SSE chunks into OpenAI-style `{"choices":[{"delta":{...}}]}` chunks for client compatibility.

Additionally, decide whether your adapter should also implement `ConvertClaudeRequest` (for clients hitting `/v1/messages`) and `ConvertGeminiRequest`. If not implementing them, return `types.NewError(errors.New("not_implemented"), types.ErrorCodeNotImplemented)`.

## Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `400 channel not found` | Forgot step 1 (channel type registration) | Add to `ChannelName2ChannelId` |
| `404 nil adaptor` | Forgot step 3 (dispatcher registration) | Add case in `GetAdaptor` |
| Usage is 0 in non-streaming responses | Provider returns different field names | Override `DoResponse` and parse the provider's usage object |
| Streaming works but usage missing | Forgot step 5 | Add to `streamSupportedChannels` |
| Quota drift | Pricing wrong in step 4 | Check `setting/ratio/` table against provider docs |
| `Authorization` header rejected | Provider uses a different auth scheme (e.g. `Api-Key:` header) | Override `SetupRequestHeader` |
| OpenAI-shape `tool_calls` not working | OpenAI-compat provider doesn't actually support tools | Add a `tool_choice` strip in `ConvertOpenAIRequest`, OR document the limitation |

## When done

Update [`relay/channel/README.md`](../../relay/channel/README.md) §"Provider inventory" with a new row for the provider — name, key format if non-standard, any caveats.

If the provider has unusual constraints (e.g. AWS Bedrock and its lack of IAM role support, see [ADR 0004](../adr/0004-channel-key-plaintext.md)... actually that's a different ADR — see `relay/channel/README.md` §"AWS Bedrock specifics"), call them out in the README so future engineers don't waste time on dead ends.
