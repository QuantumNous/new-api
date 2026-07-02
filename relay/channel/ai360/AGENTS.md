<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/ai360

## Purpose

360 AI（360gpt）适配器数据包。本目录**没有自己的 `adaptor.go`**，也不实现 `Adaptor` 接口；上游走 OpenAI 兼容协议，因此 `relay/relay_adaptor.go` 的工厂对 `ChannelType360` 直接复用 `openai.Adaptor`，仅在 `openai/adaptor.go` 的 `GetModelList` / `GetChannelName` 中通过 `switch a.ChannelType` 分派到本包的 `ModelList` / `ChannelName`。

支持 chat completions 与 embeddings（具体 RelayMode 由上层 `openai.Adaptor` 处理）。

## Key Files

| File | Description |
|------|-------------|
| `constants.go` | 仅导出两个变量：`ModelList`（8 个 360 模型，含 `360gpt-turbo` / `360gpt-pro` / `360gpt2-pro` / `embedding-bert-512-v1` / `semantic_similarity_s1_v1` 等）与 `ChannelName = "ai360"`，供 `openai.Adaptor` 按 ChannelType 取用 |

## For AI Agents

### Working In This Directory

- **不要在此目录添加 `adaptor.go`**：360 走 OpenAI 兼容协议，渠道工厂把 `ChannelType360` 路由到 `openai.Adaptor`；在此实现 `Adaptor` 接口也不会被调用。
- 修改模型清单或 ChannelName 后，`openai/adaptor.go` 第 ~664 / ~681 行的 switch 分支会自动读取新值，无需额外改动。
- 若上游协议偏离 OpenAI（鉴权头、URL 路径等），应在 `relay_adaptor.go` 与 `common/ChannelType2APIType` 中改为注册独立 adaptor，而不是修改本目录。

### Testing Requirements

- `go build ./relay/channel/ai360/...`（本目录是纯常量包，编译只会验证语法）
- `go test ./relay/channel/...`

### Common Patterns

- 常量包只声明 `ModelList []string` + `ChannelName string`，不引入任何 import。

## Dependencies

### Internal

- 无（纯常量声明）

### External

- 无

<!-- MANUAL: -->
