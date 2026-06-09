<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# relay/constant

## Purpose

relay/constant 定义 relay 子系统内部使用的枚举常量，目前核心内容是 `RelayMode`——将 HTTP 请求路径映射为整型常量，供 `RelayInfo.RelayMode` 字段使用，驱动 handler 的路由分发逻辑。

## Key Files

| File | Description |
|------|-------------|
| `relay_mode.go` | `RelayMode` iota 枚举（`RelayModeChatCompletions`、`RelayModeEmbeddings`、`RelayModeImagesGenerations`、`RelayModeRerank`、`RelayModeResponses`、`RelayModeRealtime`、`RelayModeGemini` 等 30+ 常量）；`Path2RelayMode(path)`、`Path2RelayModeMidjourney(path)`、`Path2RelaySuno(method, path)` 三个路径解析函数 |

## Subdirectories

无子目录。

## For AI Agents

### Working In This Directory

- `RelayMode` 使用 `iota` 自增，**严禁删除或调整已有常量顺序**（会导致所有依赖该常量的数值序列化数据失效）。新增常量只能追加到末尾。
- 新增 API 路径时，在 `Path2RelayMode`（或对应的专项函数 `Path2RelayModeMidjourney` / `Path2RelaySuno`）中添加对应的 `strings.HasPrefix` / `strings.HasSuffix` 匹配分支。
- 路径匹配顺序很重要：更具体的路径（如 `/v1/responses/compact`）必须排在更宽泛的路径（如 `/v1/responses`）之前，避免前缀覆盖。
- 本包只定义常量和纯函数，不引入任何外部依赖（除 `net/http` 和 `strings` 标准库）。

### Testing Requirements

- 修改 `Path2RelayMode` 后检查 `relay/common/relay_info_test.go` 中是否有路径解析相关的用例需要同步更新。
- 新增 RelayMode 常量后，在使用方（handler switch 语句）中添加对应的 case，否则会走 default/unknown 分支。

### Common Patterns

- **模式常量用途**：`RelayInfo.RelayMode` 由 `genBaseRelayInfo` 通过 `Path2RelayMode` 初始化；handler 函数通过 `info.RelayMode` 判断需要执行哪种处理逻辑（如是否需要 usage 统计、是否支持流式等）。
- **Midjourney / Suno 专项函数**：这两类 provider 的路径结构较复杂，独立拆分为 `Path2RelayModeMidjourney` 和 `Path2RelaySuno` 函数，保持 `Path2RelayMode` 主函数简洁。

## Dependencies

### Internal

无（仅依赖 Go 标准库）。

### External

- `net/http`（仅用于 `http.MethodPost` 等常量）
- `strings`

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
