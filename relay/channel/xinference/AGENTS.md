<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/xinference

## Purpose

Xinference（开源模型推理框架）provider 适配器。**本目录不实现 `Adaptor` 接口**——根据父文档 `relay/channel/AGENTS.md` 的注册说明，Xinference 在 `relay/relay_adaptor.go` 的 `GetAdaptor` 工厂中直接复用 `openai.Adaptor{}`（因为 Xinference 原生暴露 OpenAI 兼容 API）。

本目录仅存放 Xinference 特有的 **rerank 响应 DTO**，用于在 OpenAI 适配器基础上做 rerank 响应的额外解析（Xinference 的 rerank 响应结构与 OpenAI 标准略有不同：用 `relevance_score` 字段名）。

## Key Files

| File | Description |
|------|-------------|
| `constant.go` | 定义 `ModelList`（`bge-reranker-v2-m3`、`jina-reranker-v2`，均为 reranker 模型）与 `ChannelName = "xinference"` |
| `dto.go` | 定义 `XinRerankResponseDocument`（含 `Document any`、`Index int`、`RelevanceScore float64`）与 `XinRerankResponse.Results []XinRerankResponseDocument`。这是 Xinference rerank 端点的响应结构 |

## For AI Agents

### Working In This Directory

- **无 adaptor.go**：本目录没有 `Adaptor` 实现。如果需要修改 Xinference 的请求/响应行为，应在 `relay/relay_adaptor.go` 的 `GetAdaptor` 中查看 Xinference channel type 的分派逻辑（大概率直接 `return &openai.Adaptor{}, nil`），或在 `relay/channel/openai/` 中修改。
- **rerank DTO 的用途**：`XinRerankResponse` 定义在此处供其他包（如 openai 适配器或 relay handler）在解析 Xinference rerank 响应时引用。修改字段时需排查整个仓库的引用点。
- **模型列表仅 reranker**：Xinference 的 chat/embedding 模型由用户自部署，故 `ModelList` 只列默认提供的两个 reranker ID 用于渠道测试时的模型选择。

### Testing Requirements
- `go build ./relay/channel/xinference/...` 必须通过
- `go test ./relay/channel/...`

### Common Patterns
- **零适配器目录**：某些 OpenAI 完全兼容的 provider 不需要自己的 `Adaptor`，仅在 `relay/relay_adaptor.go` 注册时复用 `openai.Adaptor{}`，但仍在本目录存放 provider 专有的 DTO/常量。
- **DTO 字段映射差异**：不同 provider 的 rerank 响应字段名（`relevance_score` vs `relevance_score` vs `score` 等）通过各自 DTO 做归一化。

## Dependencies

### Internal
- 无直接 import（`dto.go` 仅定义结构体，不引用其他包；`constant.go` 为纯变量声明）

### External
- 无（纯 Go 结构体与变量定义）

<!-- MANUAL: -->
