<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-10 -->

# relay/channel

## Purpose

channel 是 40+ 上游 AI provider 适配器的汇聚目录。每个 provider 子目录实现 `Adaptor` 接口（同步请求）或 `TaskAdaptor` 接口（异步任务），通过 `relay/relay_adaptor.go` 的工厂函数统一注册。

`adapter.go` 定义了两个核心接口：
- `Adaptor`：同步请求适配器（chat/embedding/image/audio/rerank/responses）
- `TaskAdaptor`：异步任务适配器（视频/音乐/图像生成等，含计费三段式生命周期）
- `OpenAIVideoConverter`：可选接口，将上游任务结果转换为 OpenAI 视频格式

## Key Files

| File | Description |
|------|-------------|
| `adapter.go` | 定义 `Adaptor`、`TaskAdaptor`、`OpenAIVideoConverter` 三个接口，是所有 provider 必须实现的契约 |
| `api_request.go` | 通用 HTTP 请求发送逻辑，供各 adaptor 的 `DoRequest` 实现复用 |
| `api_request_test.go` | api_request 的单元测试 |

## Subdirectories

### OpenAI 兼容类（直接复用或轻量扩展 OpenAI 格式）

| Directory | Purpose |
|-----------|---------|
| `openai/` | OpenAI 原生适配器，也作为大多数兼容 provider 的基础实现 |
| `deepseek/` | DeepSeek（OpenAI 兼容，含思维链特殊处理） |
| `mistral/` | Mistral AI |
| `moonshot/` | Moonshot（Kimi），使用 Claude API 格式 |
| `perplexity/` | Perplexity AI |
| `xai/` | xAI（Grok） |
| `ollama/` | Ollama 本地模型服务 |
| `cloudflare/` | Cloudflare AI Gateway |
| `siliconflow/` | SiliconFlow |
| `openrouter/` | OpenRouter（在 relay_adaptor.go 中复用 openai.Adaptor） |
| `xinference/` | Xinference（在 relay_adaptor.go 中复用 openai.Adaptor） |
| `codex/` | OpenAI Codex API；支持 chat completions、Responses（含 compact）、**图像生成**（`gpt-image-2`，通过 `image_generation` 工具将 `/v1/images/generations` 及 `/v1/images/edits` 桥接到 `/backend-api/codex/responses` SSE 流）；`ConvertImageRequest` 强制置 `info.IsStream=true`；`DoRequest` 对图像路径非 200 响应做白标脱敏（`sanitizeCodexImageErrorResponse`）；`image_carrier_model` 可在渠道设置或全局设置中覆盖（优先级：per-channel > 全局 > 代码默认 `gpt-5.4`）；上游 `image_generation` 工具不接受 `n` 参数，图像路径每次请求只生成一张 |
| `submodel/` | 子模型/代理模型 |
| `replicate/` | Replicate |
| `mokaai/` | MokaAI |
| `jina/` | Jina AI（Rerank） |
| `cohere/` | Cohere（Rerank） |
| `dify/` | Dify 平台 |
| `coze/` | Coze 平台 |

### Claude / Anthropic 类

| Directory | Purpose |
|-----------|---------|
| `claude/` | Anthropic Claude 原生 API 适配器 |
| `aws/` | AWS Bedrock（Claude on AWS） |

### Gemini / Google 类

| Directory | Purpose |
|-----------|---------|
| `gemini/` | Google Gemini 原生 API |
| `vertex/` | Google Vertex AI（Gemini on GCP） |
| `palm/` | Google PaLM（旧版） |

### 国产模型类

| Directory | Purpose |
|-----------|---------|
| `ali/` | 阿里云通义（DashScope） |
| `baidu/` | 百度文心一言（旧版） |
| `baidu_v2/` | 百度千帆平台（新版） |
| `zhipu/` | 智谱 AI（ChatGLM，旧版 API） |
| `zhipu_4v/` | 智谱 AI（GLM-4V，新版 API） |
| `tencent/` | 腾讯混元 |
| `xunfei/` | 讯飞星火 |
| `lingyiwanwu/` | 零一万物（Yi） |
| `moonshot/` | Moonshot / Kimi |
| `minimax/` | MiniMax（海螺） |
| `volcengine/` | 火山引擎（字节跳动） |

### 异步任务类（视频 / 音乐 / 图像生成）

| Directory | Purpose |
|-----------|---------|
| `task/` | 所有异步任务 provider 的子容器（详见 `task/AGENTS.md`） |
| `jimeng/` | 即梦（图像生成，同步 Adaptor） |

### 其他 / 特殊类

| Directory | Purpose |
|-----------|---------|
| `ai360/` | 360 AI |
| `blockrun/` | BlockRun 原生直通（x402 USDC 微支付鉴权，无 API Key；按 RelayFormat 分发 Anthropic / OpenAI 请求；`x402.go` 实现 EIP-712 签名与额度上限；私钥仅用于生成签名，绝不透传）；**新增图像生成**：`/v1/images/generations`（文本生图，OpenAI 兼容直通）与 `/v1/images/image2image`（图生图/多图融合，JSON + base64 data URI，见 `buildImage2ImageBody`）；图像路径 x402 鉴权窗口上限提升至 `maxImageAuthorizationWindowSeconds`（900 s）；上游图像端点可返回 202 Accepted（异步生成中）或直接 200，`DoRequest` 通过 `resolveImageResult`（`image_async.go`）统一处理：202 触发单签名轮询直至完成，200 直接透传，非图像模式不介入 |

## For AI Agents

### Working In This Directory

- **Rule 1**：所有 JSON 操作必须通过 `common.Marshal` / `common.Unmarshal`，禁止直接使用 `encoding/json`（类型引用如 `json.RawMessage` 可保留）。
- **Rule 4**：新 channel 若支持 `stream_options`，必须在 `relay/common/relay_info.go` 的 `streamSupportedChannels` map 中注册其 `ChannelType`。
- **Rule 5**：上游 DTO 可选标量字段用指针 + `omitempty`（`*int`、`*float64`、`*bool`），不得用非指针 + `omitempty`，否则零值会被静默丢弃。

### 添加新 Channel 的标准步骤

1. **创建 provider 目录**：`relay/channel/<name>/`，至少包含 `adaptor.go`。
2. **实现 `Adaptor` 接口**（`channel/adapter.go`）：
   - `Init(info)`：初始化状态（通常存储 `RelayInfo` 引用）。
   - `GetRequestURL(info)` → 上游完整 URL。
   - `SetupRequestHeader(c, req, info)` → 设置 `Authorization` 等请求头。
   - `ConvertOpenAIRequest(c, info, request)` → 将 OpenAI 请求转换为 provider 格式；不支持的 Convert 方法返回 `nil, nil`。
   - `DoRequest(c, info, requestBody)` → 发送 HTTP 请求，返回 `*http.Response`（可复用 `api_request.go` 的通用函数）。
   - `DoResponse(c, resp, info)` → 解析上游响应，流式则逐行处理 SSE，非流式则解析 JSON 并转换为 OpenAI 格式。
   - `GetModelList()` → 返回该 provider 支持的模型列表。
   - `GetChannelName()` → 返回 provider 名称字符串。
3. **注册 APIType 常量**：在 `constant/` 包添加 `APIType<Name>` 常量，并在 `common/` 的 `ChannelType2APIType` 函数中映射。
4. **注册到工厂**：在 `relay/relay_adaptor.go` 的 `GetAdaptor` switch 中添加对应的 case。
5. **注册到 ratio_setting**：在 `setting/ratio_setting/` 中为新 provider 的模型添加默认倍率。
6. **StreamOptions**：若 provider 支持 `stream_options`，在 `relay/common/relay_info.go` 的 `streamSupportedChannels` 中注册（见 Rule 4）。
7. **前端渠道类型**（可选）：在前端 `web/default/src/` 相关配置文件中添加渠道显示名称。

### Testing Requirements

- 新增或修改适配器后运行 `go build ./relay/channel/<name>/...` 确认无编译错误。
- 运行 `go test ./relay/channel/...` 跑现有测试。
- 手动测试流式（`"stream": true`）和非流式两条路径。
- 若实现了 `ConvertEmbeddingRequest`，测试 embedding 路径。

### Common Patterns

- **Convert → DoRequest → DoResponse 三步走**：`Convert*Request` 将客户端请求转换为上游格式 → `DoRequest` 发出 HTTP 请求 → `DoResponse` 解析响应并写回客户端。
- **流式处理**：`DoResponse` 中检测 `info.IsStream`，流式时用 `bufio.Scanner` 按行读取 SSE，调用 `helper.StringData` 写出；非流式时 `io.ReadAll` 后整体解析。
- **错误转换**：上游错误统一转换为 `types.NewAPIError` / `types.OpenAIError` 后返回，使客户端始终收到标准格式。
- **模型列表**：`GetModelList()` 通常返回硬编码的 `[]string`，用于渠道测试时的模型选择。
- **OpenAI 兼容 provider**：大多数国内外兼容 provider 直接嵌入 `openai.Adaptor` 并仅覆盖 `GetRequestURL`、`SetupRequestHeader` 及少量 Convert 方法。

## Dependencies

### Internal

- `relay/common/` — `RelayInfo`、`TaskSubmitReq` 等核心类型
- `dto/` — 请求/响应 DTO（`GeneralOpenAIRequest`、`ClaudeRequest`、`GeminiChatRequest` 等）
- `types/` — `NewAPIError`、`RelayFormat`
- `model/` — `Task` 模型（TaskAdaptor 使用）
- `constant/` — `ChannelType*`、`APIType*` 常量

### External

- `github.com/gin-gonic/gin` — HTTP 上下文
- `net/http` — 标准 HTTP 客户端

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
