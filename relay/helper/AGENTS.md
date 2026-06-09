<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# relay/helper

## Purpose

relay/helper 是 relay 层的工具函数库，提供三类能力：

1. **SSE 流式输出工具**：写入 `data:` 行、flush、发送 `[DONE]`、WebSocket 消息发送。
2. **计费价格辅助**：`ModelPriceHelper`（Token 计费）、`ModelPriceHelperPerCall`（按次/量计费）、分组倍率处理、阶梯表达式计费（`modelPriceHelperTiered`）。
3. **流扫描器**：`StreamScannerHandler`（SSE 行级扫描循环）、`StreamResult`（单次回调的软错误/停止信号）、`StreamScanner`（底层 bufio.Scanner 封装）。

## Key Files

| File | Description |
|------|-------------|
| `common.go` | SSE 工具：`SetEventStreamHeaders`（幂等设置 text/event-stream 头）、`StringData` / `ObjectData` / `ClaudeData` / `ResponseChunkData`（写 data: 行）、`Done`（发 [DONE]）、`PingData`、`FlushWriter`；WebSocket 工具：`WssString` / `WssObject` / `WssError`；响应 ID 生成：`GetResponseID` / `GetLocalRealtimeID`；空/停止/usage chunk 生成：`GenerateStartEmptyResponse` / `GenerateStopResponse` / `GenerateFinalUsageResponse` |
| `price.go` | 计费辅助：`ModelPriceHelper`（标准 Token 计费，含缓存/图像/音频倍率）、`ModelPriceHelperPerCall`（MJ/Task 按次计费）、`HasModelBillingConfig`（检查模型是否有计费配置）、`HandleGroupRatio`（分组倍率与 auto_group 处理）、`modelPriceHelperTiered`（阶梯表达式计费，读取 `billing_setting.GetBillingExpr`） |
| `billing_expr_request.go` | 阶梯计费的请求输入解析：从 gin context 提取 `billingexpr.RequestInput` |
| `billing_expr_request_test.go` | 阶梯计费请求解析单元测试 |
| `stream_result.go` | `StreamResult`：单次 SSE 块回调的结果对象，提供 `Error`（软错误）、`Stop`（致命停止）、`Done`（正常结束）、`IsStopped` 方法 |
| `stream_scanner.go` | `StreamScannerHandler`：统一的 SSE 扫描循环，接收 `dataHandler` 回调逐行处理；`StreamScanner`：基于 `bufio.Scanner` 的行读取器 |
| `stream_scanner_test.go` | 流扫描器单元测试 |
| `price_test.go` | `ModelPriceHelper` 阶梯计费单元测试（`TestModelPriceHelperTieredUsesPreloadedRequestInput`） |
| `valid_request.go` | 请求合法性校验辅助 |
| `model_mapped.go` | 模型名称映射辅助 |

## Subdirectories

无子目录。

## For AI Agents

### Working In This Directory

- **Rule 1**：`common.go` 中 `ObjectData` 和 `ClaudeData` 均通过 `common.Marshal` 序列化，新增写出函数保持一致。
- **Rule 6**：修改 `price.go` 中阶梯计费逻辑前，必须先读取 `pkg/billingexpr/expr.md`（`CLAUDE.md` Rule 6）。
- `ModelPriceHelper` 和 `ModelPriceHelperPerCall` 会修改 `info.PriceData`，调用后不要再手动覆盖该字段。
- `SetEventStreamHeaders` 是幂等的（通过 `event_stream_headers_set` context key 防重复），SSE handler 中只需调用一次，无需手动判断。
- `FlushWriter` 内置 panic recover，调用方无需额外处理 flush panic。

### Testing Requirements

- 运行 `go test ./relay/helper/...` 跑单元测试（含 `stream_scanner_test.go`、`billing_expr_request_test.go`）。
- 修改 `price.go` 的计费逻辑后，通过集成测试验证实际扣费金额正确性。

### Common Patterns

- **SSE 写出模式**：`SetEventStreamHeaders(c)` → 循环调用 `StringData(c, chunk)` → `Done(c)`。
- **流扫描模式**：`StreamScannerHandler(c, resp, info, func(data string, result *StreamResult) { ... })` — 第二参数为 `*http.Response`（非 `resp.Body`），回调接收已去除 `data: ` 前缀的行字符串；用 `result.Error(err)` 记录软错误，`result.Stop(err)` 终止扫描，`result.Done()` 标记正常结束。
- **计费调用顺序**：在 handler 开始时调用 `ModelPriceHelper` 预扣 → 请求完成后由 `BillingSettler.Settle(actualQuota)` 结算，出错时 `BillingSettler.Refund(c)` 退款。
- **WebSocket 写出**：`WssObject(c, ws, obj)` 序列化并写出，`WssError(c, ws, openaiError)` 写出标准 error 事件格式。

## Dependencies

### Internal

- `relay/common/` — `RelayInfo`、`StreamStatus`、`StreamEndReason*`
- `common/` — `Marshal`、`CustomEvent`、`GetPointer`、`QuotaPerUnit`、`PreConsumedQuota`
- `dto/` — `ChatCompletionsStreamResponse*`、`ClaudeResponse`、`ResponsesStreamResponse`、`RealtimeEvent`
- `types/` — `PriceData`、`GroupRatioInfo`、`TokenCountMeta`
- `pkg/billingexpr/` — `RunExprWithRequest`、`BillingSnapshot`、`QuotaRound`
- `setting/ratio_setting/` — `GetModelRatio`、`GetModelPrice`、`GetGroupRatio` 等
- `setting/billing_setting/` — `GetBillingMode`、`GetBillingExpr`
- `setting/operation_setting/` — `GetQuotaSetting`
- `logger/` — `LogError`、`LogDebug`
- `model/` — `IsAdmin`

### External

- `github.com/gin-gonic/gin`
- `github.com/gorilla/websocket`
- `bufio`（标准库，流扫描器）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
