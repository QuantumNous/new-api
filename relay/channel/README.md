# relay/channel/ — Provider adapters

37 subdirectories, one per upstream provider (or virtual provider). Each implements `channel.Adaptor` (defined in `adapter.go`) and is wired into `relay/relay_adaptor.go:GetAdaptor()` by `constant.APIType*`.

For the relay lifecycle, see [`../README.md`](../README.md). For the architecture, see [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Provider inventory (37 total)

| Directory | Provider | Notes |
|---|---|---|
| `openai/` | OpenAI | Reference adapter; many others delegate to it for OpenAI-compatible APIs |
| `claude/` | Anthropic Claude | Native `/v1/messages`; tool use round-trip |
| `gemini/` | Google Gemini | Native Gemini shape + OpenAI-compat conversion |
| `aws/` | AWS Bedrock | **ApiKey + AKSK only — no IAM role / instance profile** (see §"AWS Bedrock specifics") |
| `vertex/` | Google Vertex AI | Vertex Claude / Gemini |
| `palm/` | Google PaLM | Legacy |
| `deepseek/` | DeepSeek | OpenAI-compatible |
| `moonshot/` | Moonshot (Kimi) | OpenAI-compatible |
| `mistral/` | Mistral | OpenAI-compatible |
| `cohere/` | Cohere | Native Cohere shape |
| `perplexity/` | Perplexity | OpenAI-compatible |
| `xai/` | xAI Grok | OpenAI-compatible |
| `openrouter/` | OpenRouter | OpenAI-compatible; delegates to `openai/` |
| `ollama/` | Ollama (local) | OpenAI + Ollama-native paths |
| `xinference/` | Xinference (local) | OpenAI-compatible; delegates to `openai/` |
| `replicate/` | Replicate | Native Replicate API |
| `cloudflare/` | Cloudflare Workers AI | Native CF shape |
| `codex/` | OpenAI Codex (OAuth flow) | Special: OAuth-based, refresh token flow |
| `ali/` | Alibaba (general) | Multiple models including Qwen |
| `baidu/` | Baidu ERNIE (v1) | Legacy auth |
| `baidu_v2/` | Baidu ERNIE (v2) | New auth scheme |
| `tencent/` | Tencent Hunyuan | — |
| `volcengine/` | ByteDance Volcengine / Doubao | OpenAI-compatible 方舟 |
| `zhipu/` | Zhipu (智谱) GLM | — |
| `zhipu_4v/` | Zhipu GLM-4V (vision) | Separate adapter for the vision variant |
| `lingyiwanwu/` | 01.AI (Yi) | — |
| `minimax/` | MiniMax | — |
| `xunfei/` | iFlytek Spark (讯飞星火) | WebSocket-based |
| `siliconflow/` | SiliconFlow (aggregator) | — |
| `submodel/` | Submodel (aggregator) | — |
| `mokaai/` | MokaAI | — |
| `ai360/` | 360 AI | — |
| `jina/` | Jina AI | Embeddings + rerank |
| `dify/` | Dify | Workflow proxy |
| `coze/` | Coze | Bot proxy |
| `jimeng/` | ByteDance Jimeng (即梦) | Image generation |
| `task/` | (not a provider) | Async task helpers used by MJ / video gen flows |

Count: 36 providers + `task/` directory = 37 entries under `relay/channel/`.

## Standard adapter file layout

Most adapters follow this shape:

```
relay/channel/<provider>/
├── adaptor.go        # implements channel.Adaptor (or a thin shim that delegates to openai/)
├── constants.go      # ChannelName const + ModelList []string
├── relay-<name>.go   # request/response handling, stream parsing
├── dto.go            # provider-specific request/response structs (optional)
└── *_test.go         # unit tests (variable coverage across providers)
```

## Adapter lifecycle (recap)

Per request, the relay handler invokes:

```
adaptor := GetAdaptor(channelType)       // from relay/relay_adaptor.go
adaptor.Init(relayInfo)
url, err := adaptor.GetRequestURL(relayInfo)
adaptor.SetupRequestHeader(c, header, relayInfo)
nativeReq, err := adaptor.ConvertOpenAIRequest(c, relayInfo, openAIReq)
resp, err := adaptor.DoRequest(c, relayInfo, body)
usage, err := adaptor.DoResponse(c, resp, relayInfo)
```

`Convert*` produces the provider-native request body from the gateway-native DTO. Multiple `Convert*` exist so the same adapter can handle clients that hit the OpenAI endpoint, the Claude endpoint, etc.

## AWS Bedrock specifics

`channel/aws/` supports two credential modes:

| Mode | Channel `key` format | Auth |
|---|---|---|
| `ApiKey` | `key|region` | Bearer token (Bedrock's API key feature) |
| `AKSK` | `ak|sk|region` | Static AWS credentials via `credentials.NewStaticCredentialsProvider` |

**Not supported (today)**: IAM role / instance profile / IRSA / pod identity. There is no code path that calls `credentials.NewEC2RoleProvider` or `config.LoadDefaultConfig`. Running this on EC2 with an instance role attached will NOT pick up the role's credentials for Bedrock — you still need to put AK/SK (or an API key) into the channel.

If you want IAM role support, that's a feature addition: extend `relay/channel/aws/adaptor.go` to accept a third mode (e.g. key format `iam|region`) that constructs the AWS SDK client with `config.LoadDefaultConfig(ctx)` so the default credential chain (env → shared config → EC2 IMDS → ECS task role) applies.

## Adding a new provider — procedure

1. **Create the directory** `relay/channel/<name>/` with:
   - `adaptor.go` — implement all 13 `channel.Adaptor` methods. Methods that don't apply to this provider should return `types.NewError(errors.New("not_implemented"), types.ErrorCodeNotImplemented)`.
   - `constants.go` — `const ChannelName = "<name>"` + `var ModelList = []string{...}`.
   - `relay-<name>.go` — request conversion, header setup, response parsing (incl. stream parsing if applicable).
   - `dto.go` — provider-specific request/response structs (optional but usually needed).

2. **Register in `relay/relay_adaptor.go`**:
   - Add `import "github.com/QuantumNous/new-api/relay/channel/<name>"`.
   - Add a case to `GetAdaptor()`: `case constant.APIType<Name>: return &<name>.Adaptor{}`.

3. **Declare channel type** in `constant/`:
   - `constant/channel.go` — add `ChannelType<Name> = <next-int>` to the iota block.
   - `constant/api_type.go` — add `APIType<Name>` if the provider warrants a new API type (often you can reuse `APITypeOpenAI` for OpenAI-compatible providers).
   - `constant/channel.go` `ChannelName2ChannelId` map — add mapping.

4. **StreamOptions support** (AGENTS.md Rule 4):
   - Confirm whether the provider supports `stream_options: {include_usage: true}`.
   - If yes, add the channel type to the `streamSupportedChannels` registration.

5. **Pricing** (`setting/ratio/`):
   - Add the provider's models to the model-ratio table so quota math works.
   - Use accurate per-1M-token prices (input + output separately).

6. **Tests**:
   - `relay-<name>_test.go` for request conversion (assert the body matches the upstream API spec).
   - Stream parsing test if the provider streams.
   - Round-trip test for OpenAI-shape → provider-native → OpenAI-shape response.

7. **Frontend display name** (optional):
   - `web/default/src/...` — add a display label for the provider in the channel-add UI if you want it to appear with a nice name instead of the raw const.

8. **Documentation**:
   - Add an entry to the inventory table at the top of this file.
   - If the provider needs special key format (e.g. AWS `ak|sk|region`), document it in `adaptor.go` package comment + ideally in the admin UI tooltip.

## Common pitfalls

- **Forgetting AGENTS.md Rule 1 (JSON wrapper)** — using `encoding/json` directly. Use `common.Marshal` / `common.Unmarshal`.
- **Non-pointer optional fields** — see AGENTS.md Rule 6. If a provider expects an explicit `false` to differ from "field absent", you need `*bool`.
- **Streaming response delta shape** — must convert to OpenAI's `{"choices":[{"delta":{...}}]}` for downstream compatibility, even when the provider sends a different SSE format.
- **Error mapping** — return `*types.NewAPIError` with an appropriate `Code`, not a bare `error`. The relay layer uses the code to decide retry / channel-disable behaviour.
- **Hardcoded URLs** — accept a `BaseURL` override in `RelayInfo`. Self-hosted variants (Xinference, Ollama) and proxies depend on this.
