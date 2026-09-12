# Data Model: Timeline 图表类型

## Entities

### 时间点 (TimePoint)
- Fields:
  - id: String
  - time: Date/String/Number
  - label: String (optional)
  - meta: Object (optional)

### 事件点 (EventPoint)
- Fields:
  - id: String
  - time: Date/String/Number
  - title: String
  - description: String (optional)
  - seriesId: String (optional)
  - seriesName: String (optional)
  - icon: String (optional)
  - meta: Object (optional)

### 系列 (Series)
- Fields:
  - id: String
  - name: String
  - style: Object (optional)

## Spec 结构（概要）
- type: 'timeline'
- data:
  - timePoints: TimePoint[]
  - eventPoints: EventPoint[]
  - series: Series[] (optional)
- layout:
  - type: 'horizontal' | 'vertical' | 'radial' | 's-curve'
  - options: Object
- tooltip/crosshair/legend: 复用现有组件结构

## Validation Rules
- 所有 EventPoint 必须包含可解析的 time
- layout.type 必须为支持的枚举之一
- 多系列时，seriesId/seriesName 至少一个有效
- timePoints 可为空，但必须支持仅 timePoints 的展示
