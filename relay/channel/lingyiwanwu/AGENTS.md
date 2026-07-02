<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/lingyiwanwu

## Purpose

零一万物（Yi 系列模型，`https://api.lingyiwanwu.com`）上游适配器。**本目录不实现 `channel.Adaptor` 接口**，仅提供 `ModelList` 与 `ChannelName` 常量，由 `relay/channel/openai/adaptor.go` 的 `GetModelList` / `GetChannelName` 按 channel type 分发时引用（见 `openai/adaptor.go:21, 667, 684`）。

零一万物 API 与 OpenAI Chat Completions 完全兼容，所以没有独立适配器的必要——直接复用 `openai.Adaptor` 即可。本目录只承担"模型清单与品牌名"的注册职责。

## Key Files

| File | Description |
|------|-------------|
| `constrants.go` | 文件名拼写有误（`constrants` 应为 `constants`），但已被 `openai/adaptor.go` import 引用，重命名需同步修改导入路径。文件内容：`ModelList`（9 个 Yi 模型：yi-large / yi-medium / yi-vision / yi-medium-200k / yi-spark / yi-large-rag / yi-large-turbo / yi-large-preview / yi-large-rag-preview）与 `ChannelName = "lingyiwanwu"` |

## For AI Agents

### Working In This Directory

- **本目录没有 `adaptor.go`**，不要假设存在 `Adaptor` 结构体。
- 引用方式：`relay/channel/openai/adaptor.go:21` 通过 `_ "github.com/QuantumNous/new-api/relay/channel/lingyiwanwu"` 间接 import，并在 `GetModelList` / `GetChannelName` 的 switch case（`ChannelTypeLingyiwanwu`）中返回 `lingyiwanwu.ModelList` / `lingyiwanwu.ChannelName`。
- **文件名 typo**：`constrants.go` 应为 `constants.go`。重命名需同步更新所有 import（当前仅 `openai/adaptor.go` 用到包级常量，包名 `lingyiwanwu` 本身不受文件名影响）。
- **修改 `ModelList` 时**：需同步更新 `setting/ratio_setting/` 中对应模型的默认倍率，否则新增模型在计费阶段会查不到价格。
- **Rule 1 / Rule 4 / Rule 5 在本目录均不适用**：无 JSON 操作、无 stream_options、无请求 DTO。

### Testing Requirements

- `go build ./relay/channel/lingyiwanwu/...` 必须通过
- `go test ./relay/channel/...`
- 修改 `ModelList` 后，验证 `openai/adaptor.go` 的 `GetModelList` 返回正确列表

### Common Patterns

- "常量包"模式：当某 provider 完全 OpenAI 兼容时，无需独立适配器，仅提供模型清单与品牌名即可。类似地，`web/classic/` 与 `web/default/` 也通过常量配置而非独立适配器接入。
- 如果未来零一万物新增非 OpenAI 兼容特性（如自定义 reasoning 字段），需要在本目录新增 `adaptor.go` 嵌入 `openai.Adaptor` 并覆盖特定方法。

## Dependencies

### Internal

- 无（纯常量声明，不 import 任何内部包）

### External

- 无

<!-- MANUAL: -->
