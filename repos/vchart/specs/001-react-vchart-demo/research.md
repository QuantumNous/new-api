# Research: React-VChart 文档示例补充

## Decision 1: 示例入口策略

- **Decision**: 在 `examples-react/component` 中新增独立示例条目，并更新 `menu.json` 增加入口。
- **Rationale**: 符合“补充一个 demo”目标，入口更清晰，且不影响现有示例行为。
- **Alternatives considered**: 复用并替换现有 `component/common` 示例。该方案会改变既有示例内容，不符合“补充”诉求。

## Decision 2: 封面资源

- **Decision**: 复用现有公共封面资源（避免新增图片资源）。
- **Rationale**: 文档示例新增不引入额外资产成本，保持文档构建与发布流程稳定。
- **Alternatives considered**: 新增专用预览图。需要额外设计与资源管理，不在本需求范围内。

## Decision 3: 示例代码组织

- **Decision**: 采用 `livedemo template=react-vchart` 代码块，直接嵌入提供的 React 代码。
- **Rationale**: 与现有 React 示例规范一致，可直接渲染并支持复制复用。
- **Alternatives considered**: 外部链接或独立 demo 页面。降低文档可读性，不利于快速上手。
