<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/blockrun

## Purpose

BlockRun (https://blockrun.ai) **VIP 原生直通** 适配器。与其他 provider 最大的差异：**不用 API Key 鉴权**，而是每请求通过 **x402 v2 / EIP-712 / ERC-3009** 协议在 Base mainnet 上用 USDC 微支付。`info.ApiKey` 实际是 EVM 钱包私钥（0x 前缀 hex），**仅用于本地签名，绝不透传到上游**。

请求流程（`DoRequest`）：
1. 无签名首请求 → 上游返回 HTTP 402，支付要求在 `Payment-Required` / `X-Payment-Required` / `Www-Authenticate: X402 requirements=...` 头里。
2. `SignX402Payment` 校验 402 参数（network=Base、asset=USDC、金额上限、validBefore 窗口、payTo 地址格式），用私钥签 ERC-3009 `TransferWithAuthorization`，返回 base64 签名。
3. 把签名塞进 `gin.Context` 的 `ctxKeyPaymentSignature`，重放同一请求——`SetupRequestHeader` 读 context 注入 `PAYMENT-SIGNATURE` 头。
4. 若重放仍 402，**硬失败**（不再签名，避免重复扣款）。

入站格式分派（VIP 原生直通，零改写）：
- **Anthropic Messages** → `/v1/messages`，`DoResponse` 委托内嵌的 `claude.Adaptor.DoResponse`。
- **OpenAI Chat Completions** → `/v1/chat/completions`，`DoResponse` 委托内嵌的 `openai.Adaptor.DoResponse`。
- **Gemini** → 拒绝（VIP 仅支持 Anthropic + OpenAI）。
- **图像 generations** → `/v1/images/generations`（OpenAI 兼容 JSON 直通）。
- **图像 image2image** → `/v1/images/image2image`（JSON + base64 data URI，客户端用标准 OpenAI multipart/form-data 上传，适配器转 base64）。

图像路径支持同步（200）与异步（202 + `poll_url`）两种上游响应，由 `resolveImageResult` 统一分派；异步路径在 `pollImageJob` 中用同一签名轮询直到完成（`imagePollBudget=300s`、`imagePollInterval=3s`）。流式图像（客户端 `stream=true`）由本适配器**本地合成 SSE**（`streamImageResponse` + `startImageHeartbeat` 心跳）。

白标：图像结果强制下载并转 base64 返回（`ensureImageB64`），上游 CDN URL 永不暴露给客户端。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 定义 `Adaptor struct{ openaiAdaptor, claudeAdaptor }` 实现 `Adaptor` 接口（嵌入两个 adaptor 仅复用 `DoResponse`，其余方法全部覆盖）；`Init` 同时初始化两个嵌入 adaptor；`GetRequestURL` 按 RelayMode（image 优先）与 RelayFormat 分派；`SetupRequestHeader` **绝不设 x-api-key / Authorization**（安全红线），只设 Content-Type、anthropic-version、anthropic-beta 与 PAYMENT-SIGNATURE；`ConvertImageRequest` 剥除 stream/partial_images（上游不懂）后分派 generations/edits；`DoRequest` 实现 402 双跳；`DoResponse` 先做 image stream/json 分派，再调 `captureUpstreamID` 后委托 |
| `constants.go` | `ChannelName = "blockrun"`、`ModelList`（Anthropic / OpenAI / Google / DeepSeek / Moonshot / ZAI / MiniMax / Nvidia 多家 chat 模型 + 图像模型 `openai/gpt-image-2/1`、`openai/dall-e-3`、`google/nano-banana[-pro]`、`black-forest/flux-1.1-pro`、`xai/grok-imagine-image[-pro]`、`zai/cogview-4`，共 ~45 项）|
| `x402.go` | x402 支付核心：`SignX402Payment` / `SignX402PaymentWithLimits` / `SignX402PaymentWithCaps`（视频/图像路径可覆写金额与时间窗上限）、`validatePaymentOption*`（trust-boundary 校验）、`extractPaymentRequired`（三种 header 变体探测）、`parsePrivateKey`（严格校验 32 字节 secp256k1）、`assertAmountWithinCap`、`looksLikeEthAddress`；常量 `maxAmountAtomicUSDC=5_000_000`（$5/次）、`maxAuthorizationWindowSeconds=300`、`maxImageAuthorizationWindowSeconds=900`、`expectedNetworkBase/BaseSepolia`、`expectedAssetUSDCBase` |
| `image_async.go` | 图像异步任务处理：`resolveImageResult`（200 透传 / 202+image fast-path 改 200 / 202+poll_url 进入轮询）、`pollImageJob`（单签名轮询，402 即硬错；504 继续；客户端 disconnect 即退出）、`doImagePoll`、`absolutePollURL`（**SSRF 防御**：host 必须等于 channel base host）、`imageBodyProbe`（最小探针结构）、`captureTxHash` / `captureEnvelopePrice`（结算信号写入 `constant.ContextKeyBlockRunSettlement`）、`readAndCloseBody` / `rewrapResponse` |
| `image_edits.go` | multipart→JSON 转换：`buildImage2ImageEditBody`（读 image/image[]/image[N]/mask 文件 → base64 data URI）、`collectMultipartFiles`（按数字下标自然排序，保证多图融合顺序）、`bracketIndex`、`multipartFilesToDataURIs`、`maxImageEditImages=16` |
| `image_response.go` | 非流式图像响应：`imageJSONResponseB64`（解析 → `ensureImageB64` 每张图 → 重序列化输出）、`ensureImageB64`（URL→base64 下载；失败时降级保留 URL 而非整体失败，因上游扣款已发生）、`downloadImageAsBase64`（走全局 SSRF 过滤） |
| `image_stream.go` | 流式图像响应：`streamImageResponse`（本地合成 SSE：每个 `image_generation.completed` / `image_edit.completed` 事件对应一张图，`[DONE]` 结束）、`startImageHeartbeat`（10s 间隔 SSE comment，防 LB idle timeout）、`writeImageStreamError`、`isImageStreamMode` / `isImageMode`、`imageDownloadTimeout=60s` |
| `response_id.go` | 上游 call id 捕获：`captureUpstreamID`（流式/非流式分派）、`captureNonStreamID`（buffer body + unmarshal top-level id）、`streamIDSniffer`（byte-transparent ReadCloser wrapper，扫描首个 `"id":"..."` 即停；上限 64 KiB）、`replayCloser`（回放 buffered body）、`mergeSettlement` |

## For AI Agents

### Working In This Directory

- **`info.ApiKey` 是 EVM 私钥，绝对不能透传**。`SetupRequestHeader` 刻意不调用 `openaiAdaptor.SetupRequestHeader` / `claudeAdaptor.SetupRequestHeader`（它们会设 x-api-key / Authorization），就是因为这个安全红线。修改 SetupRequestHeader 时务必保持。私钥错误信息也不要泄露任何子串——`parsePrivateKey` 的错误消息已经做了脱敏。
- **信任边界**：x402 协议的 402 响应由同一上游产生，妥协的上游可以伪造任意金额/窗口/payTo。`validatePaymentOption*` 是唯一防线，**不要放宽**任何一项检查（network、asset、amount、window、payTo 格式）。如果上游真的需要新网络/新资产，必须显式扩 allowlist 并 review。
- **图像路径时间窗放宽**：`maxImageAuthorizationWindowSeconds=900s` 是图像端点唯一允许的放宽，因为 BlockRun 在生成期间需要保持签名有效。chat/video 仍用 300s。如果未来要为其他端点放宽窗口，参考 `SignX402PaymentWithCaps` 的显式参数模式，不要改默认值。
- **签名重用而非重签**：`pollImageJob` 拿到 402 时**硬错**，不再重签——因为每次签名等于一次链上 transfer 授权，重复签名会被多次扣款。修改 polling 逻辑时严守这条。
- **白标**：`ensureImageB64` 强制把 URL 转 base64 返回，客户端永远收不到 BlockRun CDN 的 host。即便下载失败，也只是降级（保留 URL + 警告日志），而不是抛错——因为上游已经扣款，失败回错会让用户付了钱拿不到图。改这条逻辑时理解 trade-off。
- **`captureUpstreamID` 的结构感知**：非流式 body 里 `choices` 在 top-level `id` 之前，naive `"id"` regex 会先命中 `tool_calls[].id`，所以非流式必须 buffer + unmarshal；流式首个 chunk 的 top-level id 在 tool_call id 之前，所以用 regex 取首个即可。修改时不要把两条路径合并。
- **多节点（Rule 11）**：所有支付签名都是链上 nonce-protected 的（ERC-3009 单次使用），自然防止跨节点重复扣款；但 `pollImageJob` 的轮询是 process-local 的，客户端断开重连到另一节点会丢失轮询上下文。生产环境使用 BlockRun 时需告知运营方这个限制。
- **`maxImageBodyBytes=64MiB`**：单个图像响应/上传文件上限。改它时同步评估 `DecompressRequestMiddleware` 的 `MaxRequestBodyMB`。
- **`collectMultipartFiles` 的排序**：多图融合依赖数字下标自然排序（`image[10]` 在 `image[2]` 之后），改排序逻辑会破坏多图融合的顺序合约。
- 适用 Rule 1（全部用 `common.Marshal` / `common.Unmarshal` / `common.UnmarshalJsonStr`）；适用 Rule 4（blockrun 在 `streamSupportedChannels` 中注册，`ConvertOpenAIRequest` 不动 `StreamOptions`）；适用 Rule 5（本目录请求结构多用 map[string]any 透传，没有 struct tag 问题）。
- **`ctxKeyPaymentSignature` gin.Context 传递**：DoRequest 把签名写入 context，SetupRequestHeader 读 context——这让重放走同一条 `channel.DoApiRequest` 路径，HeaderOverride/proxy/X-Request-Id/SSE keep-alive 全部自动一致。修改时不要把两跳拆到不同的 HTTP client。

### Testing Requirements

- `go build ./relay/channel/blockrun/...` 必须通过
- `go test ./relay/channel/blockrun/...`（有 `adaptor_test.go` / `image_async_test.go` / `image_response_test.go` / `image_stream_test.go` / `response_id_test.go` / `url_test.go` / `x402_validate_test.go` / `x402_e2e_test.go`）
- 关键路径：402 双跳、payment 参数 trust-boundary 拒绝、异步图像 202→轮询→200、流式图像 SSE 合成、image2image multipart→base64、poll_url SSRF 拒绝
- 安全路径：私钥格式校验、签名重用而非重签、image CDN URL 不泄露

### Common Patterns

- **嵌入 + 覆盖**：`Adaptor` 内嵌 `openai.Adaptor` + `claude.Adaptor`，但仅复用其 `DoResponse`；其他接口方法（`Init` / `GetRequestURL` / `SetupRequestHeader` / 所有 Convert / `DoRequest`）全部覆盖，因为 x402 流程与钱包安全红线是跨格式的。
- **gin.Context 跨方法传参**：`ctxKeyPaymentSignature` / `constant.ContextKeyBlockRunSettlement` / `common.UpstreamRequestIdKey` 三个 key 用于在 DoRequest → SetupRequestHeader / DoResponse → 后续计费日志之间传非全局状态。
- **`channel.DoApiRequest` 复用**：402 首跳与签名重放都走 `channel.DoApiRequest`，不自建 HTTP client——保证 HeaderOverride / proxy / X-Request-Id / SSE keep-alive 全部一致。
- **map[string]any body 透传**：image2image body 用 map 而非 struct，避免字段类型耦合到上游 schema 演化。
- **降级优先于失败**：图像下载失败、heartbeat 写入失败、limit hit 都倾向降级（保留 URL / 写 SSE error / 显式截断错误）而非 panic，因为上游扣款已发生。

## Dependencies

### Internal

- `relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`、`ResolveHeaderOverride`
- `relay/channel/openai` — 嵌入 `Adaptor`（Init + ConvertImageRequest + DoResponse）
- `relay/channel/claude` — 嵌入 `Adaptor`（Init + DoResponse）
- `relay/common` — `RelayInfo`、`GetFullRequestURL`（不用，但常量引用）
- `relay/constant` — `RelayModeImagesGenerations` / `ImagesEdits`
- `relay/helper` — `SetEventStreamHeaders`、`PingData`、`ObjectData`、`Done`、`FlushWriter`
- `service` — `GetHttpClientWithProxy`、`GetHttpClient`
- `setting/system_setting` — `GetFetchSetting`（SSRF 防御配置）
- `dto` — `GeneralOpenAIRequest`、`ClaudeRequest`、`GeminiChatRequest`、`ImageRequest`、`EmbeddingRequest`、`AudioRequest`、`RerankRequest`、`OpenAIResponsesRequest`、`ImageResponse`、`ImageData`、`Usage`
- `types` — `NewAPIError`、`NewError`、`NewOpenAIError`、`ErrorCode*`（`ReadResponseBodyFailed` / `BadResponseBody`）、`ErrOptionWithSkipRetry`、`RelayFormatClaude` / `RelayFormatGemini` / `RelayFormatOpenAI`
- `common` — `Marshal`、`Unmarshal`、`ValidateURLWithFetchSetting`、`Interface2String`、`LocalLogPreview`、`SysError`、`UpstreamRequestIdKey`
- `constant` — `ContextKeyBlockRunSettlement`
- `logger` — `LogWarn`、`LogDebug`

### External

- `github.com/BlockRunAI/blockrun-llm-go` — 官方 SDK，`ParsePaymentRequired` / `CreatePaymentPayload` / `PaymentRequirement` / `PaymentOption`
- `github.com/ethereum/go-ethereum/crypto` — secp256k1 私钥解析与签名
- `github.com/gin-gonic/gin`
- 标准库 `bytes`、`context`、`crypto/ecdsa`、`encoding/base64`、`fmt`、`io`、`math/big`、`mime/multipart`、`net/http`、`net/url`、`regexp`、`sort`、`strconv`、`strings`、`sync`、`time`

<!-- MANUAL: -->
