# Research: Timeline 图表类型

## 决策与依据

### Decision 1: 支持四种布局类型作为首期范围
- **Decision**: 首期支持横向、纵向、径向、S 线布局
- **Rationale**: 覆盖信息图中最常见的时间轴呈现方式，满足多场景展示
- **Alternatives considered**: 仅支持横纵布局（功能不足），增加更多复杂布局（成本过高）

### Decision 2: 事件点与时间点作为独立实体
- **Decision**: 事件点与时间点独立建模，事件点关联时间点
- **Rationale**: 支持仅时间点或密集事件点的场景，同时增强多系列扩展性
- **Alternatives considered**: 仅事件点（无法表达空时间点），仅时间点（无法表达事件内容）

### Decision 3: 多系列以系列标识区分
- **Decision**: 使用 seriesId/seriesName 区分多系列事件点
- **Rationale**: 与现有图表体系一致，便于样式与交互对齐
- **Alternatives considered**: 仅颜色区分（缺乏语义）、嵌套结构（复杂度更高）

### Decision 4: 交互一致性与性能目标沿用项目规范
- **Decision**: Tooltip/Crosshair/Legend 交互对齐全局规范，交互响应 <16ms
- **Rationale**: 符合宪法要求，减少跨端差异
- **Alternatives considered**: 允许不同端行为（增加维护成本）

## 未解决问题

无 NEEDS CLARIFICATION 项，研究阶段完成。
