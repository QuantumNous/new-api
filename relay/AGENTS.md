<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# relay

## Purpose

relay 是整个网关的核心中继子系统，负责将客户端的 AI API 请求路由到 40+ 上游 provider，并将上游响应转换回统一的 OpenAI 兼容格式返回给客户端。

主要职责：
- 按请求格式（OpenAI / Claude / Gemini / Rerank / Image / Audio / Responses / Realtime / Task）分发到对应的 handler
- 通过 `relay_adaptor.go` 的工厂函数 `GetAdaptor` / `GetTaskAdaptor` 实例化 provider 适配器
- 统一处理计费预扣（pre-consume）、结算（settle）、退款（refund）的生命周期
- 支持参数覆盖（param override）、系统提示注入（system prompt injection）、流式/非流式双模式

## Key Files

| File | Description |
|------|-------------|
| `relay_adaptor.go` | 工厂文件：`GetAdaptor(apiType)` 返回同步 `Adaptor`；`GetTaskAdaptor(platform)` 返回异步 `TaskAdaptor`，是新增 provider 的注册入口 |
| `chat_completions_via_responses.go` | 将 `/v1/chat/completions` 请求桥接到 OpenAI Responses API 路径的转换层 |
| `claude_handler.go` | Claude 原生格式（`/v1/messages`）请求的入口 handler |
| `gemini_handler.go` | Gemini 原生格式（`/v1beta/models`）请求的入口 handler |
| `compatible_handler.go` | OpenAI 兼容格式通用 handler，处理 chat/completions/embeddings 等 |
| `image_handler.go` | 图像生成（`/v1/images/generations`、`/v1/images/edits`）handler |
| `audio_handler.go` | 音频 TTS / 语音转录 handler |
| `embedding_handler.go` | Embeddings handler |
| `rerank_handler.go` | Rerank handler |
| `responses_handler.go` | OpenAI Responses API handler |
| `relay_task.go` | 异步任务（视频/图像生成等）提交、计费预扣、结果轮询入口 |
| `websocket.go` | Realtime WebSocket 中继 handler |
| `mjproxy_handler.go` | Midjourney 代理 handler |
| `param_override_error.go` | 参数覆盖失败时的错误处理辅助 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `channel/` | 40+ provider 适配器实现，每个 provider 一个子目录 |
| `common/` | 贯穿整个 relay 的共享数据结构：`RelayInfo`、`TaskSubmitReq`、`TaskInfo`、`BillingSettler` 接口等 |
| `common_handler/` | 跨 provider 复用的响应处理逻辑（目前含 Rerank） |
| `constant/` | relay 内部常量：`RelayMode` 枚举及路径到模式的映射 |
| `helper/` | 流式输出工具（SSE flush、ObjectData）、计费价格辅助（ModelPriceHelper）、流扫描器（StreamScannerHandler） |
| `reasonmap/` | Claude ↔ OpenAI finish_reason / stop_reason 相互转换映射 |

## For AI Agents

### Working In This Directory

- **Rule 1**：所有 JSON 序列化/反序列化必须通过 `common.Marshal` / `common.Unmarshal`（见 `CLAUDE.md` Rule 1），不得直接调用 `encoding/json`。
- **Rule 4**：新增 provider 适配器后，若该 provider 支持 `stream_options`，必须将其 `ChannelType` 加入 `relay/common/relay_info.go` 的 `streamSupportedChannels` map。
- **Rule 6**：上游 DTO 中的可选标量字段必须使用指针类型 + `omitempty`，避免零值被静默丢弃。
- 新增 provider 时，在 `relay_adaptor.go` 的 `GetAdaptor` 或 `GetTaskAdaptor` switch 中注册对应的 `Adaptor` 实现。
- handler 文件只做流程编排（构建 RelayInfo、调用适配器、处理计费），业务逻辑下沉到 `channel/` 适配器或 `service/`。

### Testing Requirements

- 修改 handler 逻辑后，在本地运行 `go test ./relay/...` 确认无编译错误。
- 涉及流式处理改动时，手动测试 `stream: true` 和 `stream: false` 两种路径。
- 新增 provider 适配器后运行 `go build ./...` 确保全量编译通过。

### Common Patterns

- **请求生命周期**：`GenRelayInfo*()` 构建 `RelayInfo` → `adaptor.Init()` → `adaptor.Convert*Request()` → `adaptor.DoRequest()` → `adaptor.DoResponse()` → 计费结算。
- **计费预扣**：`helper.ModelPriceHelper` 计算预扣额度，`info.Billing.Settle(actualQuota)` 在响应完成后结算，`info.Billing.Refund(c)` 在出错时退款。
- **流式 SSE**：`helper.SetEventStreamHeaders` 设置响应头，`helper.StringData` / `helper.ObjectData` 写入 `data:` 行，`helper.Done` 发送 `[DONE]`。
- **任务异步流**：`relay_task.go` 的 `ResolveOriginTask` + `DoTaskRequest` 负责任务提交；轮询逻辑在 `controller/` 层通过 `TaskAdaptor.FetchTask` / `ParseTaskResult` 完成。

## Dependencies

### Internal

- `relay/channel/` — provider 适配器
- `relay/common/` — `RelayInfo`、`TaskInfo`、`BillingSettler` 等共享类型
- `relay/constant/` — `RelayMode` 枚举
- `relay/helper/` — SSE 工具、价格辅助
- `relay/reasonmap/` — finish_reason 映射
- `service/` — 计费、日志、配额管理
- `dto/` — 请求/响应 DTO
- `model/` — 任务数据库操作

### External

- `github.com/gin-gonic/gin` — HTTP 框架
- `github.com/gorilla/websocket` — WebSocket 支持

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
