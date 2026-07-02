<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/baidu_v2

## Purpose

百度千帆 **v2 OpenAI 兼容** API 适配器。上游端点形如 `{ChannelBaseUrl}/v2/chat/completions`、`.../embeddings`、`.../images/generations`、`.../images/edits`、`.../rerank`，鉴权用 `Bearer {token}`，可选附加 `appid` 请求头。

`ConvertOpenAIRequest` 有一个特殊分支：当 `info.UpstreamModelName` 以 `-search` 结尾时，剥掉该后缀并注入 `web_search = {enable, enable_citation, enable_trace}` 子对象（仅在客户端未自带 `WebSearch` 时）。其余 chat / embedding / image / rerank 请求基本透传，`DoResponse` 直接委托给 `openai.Adaptor.DoResponse`。

实际实现的 Convert：`ConvertOpenAIRequest`（含 search 分支）、`ConvertClaudeRequest`（委托 `openai.Adaptor.ConvertClaudeRequest`）。`ConvertRerankRequest` / `ConvertEmbeddingRequest` / `ConvertImageRequest` / `ConvertAudioRequest` / `ConvertGeminiRequest` / `ConvertOpenAIResponsesRequest` 返回 `nil, errors.New("not implemented")`。

> ⚠️ **`ChannelName` 当前是 `"volcengine"`**（`constants.go:29`）。这看上去是复制粘贴遗留 bug，但**本文档描述代码现状**，修改它属于 breaking change（会影响 `GetChannelName()` 的返回值），需单独评估。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 定义 `Adaptor struct{}` 并实现 `Adaptor` 接口；`GetRequestURL` 按 RelayMode 拼 `/v2/...` 路径；`SetupRequestHeader` 解析 `info.ApiKey` 形如 `<token>\|<appid>`，设 Bearer + 可选 `appid` 头；`ConvertOpenAIRequest` 处理 `-search` 后缀 |
| `constants.go` | `ModelList`（ernie-4.0 / ernie-3.5 / ernie-speed / ernie-lite / deepseek-v3 / deepseek-r1 等 23 项）+ `ChannelName = "volcengine"`（疑似笔误，见上）|

## For AI Agents

### Working In This Directory

- **API Key 格式 `<token>\|<appid>`**：分隔符 `|`，第二段为可选 appid。空 token 会直接报错；只有一段时也合法（不设 appid）。
- **`-search` 后缀模型注入**：当用户在渠道配置了形如 `ernie-4.0-8k-search` 的模型时，本适配器会把它重写为 `ernie-4.0-8k` 并强制开启 `web_search`。不要在 `ConvertOpenAIRequest` 之外再处理这个后缀。
- **`DoResponse` 完全委托 openai.Adaptor**：百度 v2 的 OpenAI 兼容性足以复用 openai handler，本目录**没有自己的响应解析代码**。修复流式/非流式响应 bug 时优先看 `relay/channel/openai/`。
- **`ChannelName` 疑似 bug**：改动前先确认是否影响下游（`GetChannelName` 的调用方多为日志/展示层）。
- 适用 Rule 1：JSON 操作走 `common.*`（本目录目前没有显式 Marshal/Unmarshal 调用，因为请求是透传 map / struct）。

### Testing Requirements

- `go build ./relay/channel/baidu_v2/...` 必须通过
- `go test ./relay/channel/...`

### Common Patterns

- 所有未实现的 Convert 返回 `errors.New("not implemented")`，而不是返回零值，便于上层立即失败。
- `ConvertClaudeRequest` 直接实例化 `openai.Adaptor{}` 并委托——这个模式在本仓库多个 OpenAI 兼容 adapter 里反复出现。

## Dependencies

### Internal

- `relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `relay/channel/openai` — 复用 `Adaptor.ConvertClaudeRequest` 与 `Adaptor.DoResponse`
- `relay/common` — `RelayInfo`
- `relay/constant` — `RelayModeChatCompletions` / `Embeddings` / `ImagesGenerations` / `ImagesEdits` / `Rerank`
- `dto` — `GeneralOpenAIRequest`、`ClaudeRequest`、`AudioRequest`、`ImageRequest`、`RerankRequest`、`EmbeddingRequest`、`OpenAIResponsesRequest`、`GeminiChatRequest`
- `types` — `NewAPIError`

### External

- `github.com/gin-gonic/gin`
- 标准库 `errors` / `fmt` / `io` / `net/http` / `strings`

<!-- MANUAL: -->
