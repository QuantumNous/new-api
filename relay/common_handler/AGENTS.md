<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# relay/common_handler

## Purpose

common_handler 存放**跨 provider 复用的响应处理逻辑**，目前包含 Rerank（文档重排序）的统一响应处理器。与 provider 特定的 `DoResponse` 不同，这里的 handler 在多个 provider 的 `Adaptor.DoResponse` 中被调用，避免重复实现相同的响应解析和格式转换逻辑。

## Key Files

| File | Description |
|------|-------------|
| `rerank.go` | `RerankHandler`：接收上游 HTTP 响应，解析 Jina/Cohere 格式或 Xinference 特有格式的 Rerank 响应，统一转换为 `dto.RerankResponse` 后写回客户端 |

## Subdirectories

无子目录。

## For AI Agents

### Working In This Directory

- **Rule 1**：`rerank.go` 中已使用 `common.Unmarshal`，新增响应处理函数时保持一致，禁止直接调用 `encoding/json`。
- 本包函数签名约定：`func XxxHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError)`，与 relay 层的调用约定保持一致。
- 新增 handler 前确认该逻辑确实被 2 个以上 provider 复用，单 provider 专属逻辑应放在对应 `channel/<name>/` 子目录。
- Xinference 的 Rerank 响应格式与 Jina 标准格式不同，已在 `RerankHandler` 中通过 `info.ChannelType` 分支处理，新增特殊格式 provider 时在同一函数中添加分支。

### Testing Requirements

- 运行 `go build ./relay/common_handler/...` 确认编译通过。
- `RerankHandler` 目前无独立单元测试，修改时建议通过集成测试验证 Rerank 端到端流程。

### Common Patterns

- **响应体一次性读取**：`io.ReadAll(resp.Body)` 后立即 `service.CloseResponseBodyGracefully(resp)`，再解析字节切片，避免流泄漏。
- **格式分支**：通过 `info.ChannelType` 或 `info.ChannelMeta` 判断 provider，执行对应的解析逻辑，最终写出统一格式。
- **Usage 回传**：handler 返回 `*dto.Usage` 供调用方进行计费结算。

## Dependencies

### Internal

- `relay/common/` — `RelayInfo`（含 `ChannelType`、`ReturnDocuments`、`Documents` 等）
- `relay/channel/xinference/` — `XinRerankResponse`（Xinference 特有响应结构）
- `dto/` — `RerankResponse`、`RerankResponseResult`、`Usage`
- `types/` — `NewAPIError`、`ErrorCode*`
- `common/` — `Unmarshal`、`DebugEnabled`
- `service/` — `CloseResponseBodyGracefully`

### External

- `github.com/gin-gonic/gin`
- `net/http`

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
