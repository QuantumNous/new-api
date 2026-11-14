# Quickstart: Timeline 图表类型

## 目标
用最小配置创建一个 Timeline 图表，展示时间点与事件点，并切换布局。

## 步骤

1. 准备数据
   - 至少包含一组事件点
   - 可选提供时间点与系列信息

2. 选择布局类型
   - horizontal / vertical / radial / s-curve

3. 渲染图表
   - 使用 Timeline 图表类型与配置项

## 最小示例（结构示意）

```json
{
  "type": "timeline",
  "layout": { "type": "horizontal" },
  "data": {
    "timePoints": [
      { "id": "t1", "time": "2025-01-01", "label": "开始" }
    ],
    "eventPoints": [
      { "id": "e1", "time": "2025-01-01", "title": "事件 A" }
    ],
    "series": [
      { "id": "s1", "name": "系列 1" }
    ]
  }
}
```

## 成功标准
- 图表能展示时间点与事件点
- 切换布局后视觉结构发生变化
