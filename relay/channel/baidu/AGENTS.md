<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/baidu

## Purpose

百度文心一言 **旧版** RPC API 适配器（千帆 v1 的 `ai_custom/v1/wenxinworkshop`）。URL 形如 `{ChannelBaseUrl}/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/<suffix>?access_token=<token>`，`<suffix>` 由 `GetRequestURL` 按 `info.UpstreamModelName` 查表生成（如 `ERNIE-4.0` → `completions_pro`、`ERNIE-Bot-turbo` → `eb-instant`、`Embedding-V1` → `embedding-v1` 等，未命中时 fallback 到 `strings.ToLower(modelName)`）。

**鉴权方式特殊**：不在 HTTP 头里带 API key。`info.ApiKey` 必须形如 `<ak>\|<sk>`，`getBaiduAccessToken` 用这对 AK/SK 调 `https://aip.baidubce.com/oauth/2.0/token` 换 access_token，缓存在 `sync.Map` (`baiduTokenStore`) 中按 apiKey 为 key 共享，**token 即将过期时（剩余 < 1h）异步刷新**。最终把 token 拼到 URL query。

实际实现的 Convert：`ConvertOpenAIRequest`（`requestOpenAI2Baidu`）、`ConvertEmbeddingRequest`（`embeddingRequestOpenAI2Baidu`）。其余 Convert（image/audio/rerank/responses/claude/gemini）均返回 `errors.New("not implemented")`，`ConvertClaudeRequest` 直接 `panic("implement me")`。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 定义 `Adaptor struct{}` 实现 `Adaptor` 接口；`GetRequestURL` 是核心逻辑——模型名→URL suffix 的查表 + 拼 access_token；`SetupRequestHeader` 仅设 Bearer + 公共头；`DoResponse` 按 `info.IsStream` / `RelayModeEmbeddings` 分派到自研 handler |
| `constants.go` | `ModelList`（ERNIE-4.0/3.5/Speed/Lite/Tiny、BLOOMZ-7B、Embedding-V1、bge-large-zh/en、tao-8k 共 16 项）+ `ChannelName = "baidu"` |
| `dto.go` | 百度专属请求/响应结构：`BaiduMessage`、`BaiduChatRequest`（含 `System`/`DisableSearch`/`EnableCitation`/`MaxOutputTokens`/`UserId` 等）、`BaiduChatResponse` / `BaiduChatStreamResponse`（含 `SentenceId`/`IsEnd`）、`BaiduEmbeddingRequest` / `BaiduEmbeddingResponse`、`Error`、`BaiduAccessToken` / `BaiduTokenResponse` |
| `relay-baidu.go` | 转换与响应处理：`requestOpenAI2Baidu` / `responseBaidu2OpenAI` / `streamResponseBaidu2OpenAI` / `embeddingRequestOpenAI2Baidu` / `embeddingResponseBaidu2OpenAI`；`baiduStreamHandler`（用 `helper.StreamScannerHandler` 逐行解析）、`baiduHandler`（非流式）、`baiduEmbeddingHandler`；`getBaiduAccessToken` + `getBaiduAccessTokenHelper`（含 token 缓存 + 临近过期异步刷新）|

## For AI Agents

### Working In This Directory

- **不要把 baidu 和 baidu_v2 混淆**：`baidu/` 是 RPC + access_token 的旧协议，`baidu_v2/` 是 OpenAI 兼容 + Bearer。两个适配器各自独立，URL/请求格式/响应处理完全不同。
- **Token 刷新机制**：`getBaiduAccessTokenHelper` 在 access_token 剩余 < 1 小时时启动 goroutine 异步刷新。修改时注意**多节点并发刷新风险**（Rule 11）：多个进程同时刷新会触发多次上游 token 接口，但百度接口本身幂等，不会造成数据问题；只是浪费配额。
- **`ConvertClaudeRequest` 会 panic**：调用方不应进入此分支，但**严禁在没有保护的情况下调用**。
- **`BaiduChatRequest.MaxOutputTokens` 用 `*int` + `omitempty`**（`dto.go:24`），符合 Rule 5；`Temperature` 同样是指针。新增字段请保持指针 + omitempty 约定。
- **`relay-baidu.go` 中混用 `encoding/json` 和 `common.Unmarshal`**：`baiduHandler` / `baiduEmbeddingHandler` 仍用 `json.Unmarshal` / `json.Marshal`（**违反 Rule 1**）；流式 handler 用 `common.Unmarshal`。改动本目录时应统一到 `common.*`，但不要在无关 PR 中扩大范围。
- **`MaxOutputTokens` 特殊处理**：`requestOpenAI2Baidu` 在 `max_tokens == 1` 时强制改成 2（百度侧 min 是 2），新增 sampling 参数时要留意类似下界。
- **`UserId` 字段透传**：`requestOpenAI2Baidu` 把 `request.User`（`json.RawMessage`）原样赋给 `BaiduChatRequest.UserId`，保留了类型自由度。

### Testing Requirements

- `go build ./relay/channel/baidu/...` 必须通过
- `go test ./relay/channel/...`（本目录无独立测试文件）
- 验证流式 + 非流式两条路径，以及 token 缓存命中/刷新分支

### Common Patterns

- **`sync.Map` 缓存 + 异步刷新**：`baiduTokenStore` 是 process-local 的，每个 new-api 实例各自缓存，符合 Rule 11 的"进程内缓存"语义（不跨节点共享，但 token 本身可重复获取）。
- **错误透传**：百度响应里的 `Error.ErrorMsg` 不为空时整体失败，handler 把它包成 `types.NewError`。
- 流式 handler 用 `helper.StreamScannerHandler` 而不是直接 `bufio.Scanner`，自动处理 SSE 帧切分与 keep-alive。

## Dependencies

### Internal

- `relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relay/common` — `RelayInfo`
- `relay/constant` — `RelayModeEmbeddings`
- `relay/helper` — `StreamScannerHandler`、`ObjectData`、`StreamResult`
- `dto` — `GeneralOpenAIRequest`、`EmbeddingRequest`、`Usage`、`OpenAITextResponse`、`OpenAIEmbeddingResponse`、`ChatCompletionsStreamResponse`、`ClaudeRequest`、`ImageRequest` 等
- `service` — `CloseResponseBodyGracefully`、`GetHttpClient`
- `types` — `NewError`、`ErrorCodeBadResponseBody`
- `common` — `SysLog`、`Unmarshal`（流式）
- `constant` — `FinishReasonStop`

### External

- `github.com/gin-gonic/gin`
- `github.com/samber/lo` — `FromPtrOr`
- 标准库 `encoding/json`、`sync`、`time`、`strings`、`fmt`、`io`、`net/http`、`errors`

<!-- MANUAL: -->
