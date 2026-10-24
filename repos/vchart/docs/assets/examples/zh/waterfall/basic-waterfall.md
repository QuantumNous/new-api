---
category: demo
group: waterfall
title: 基础瀑布图
keywords: waterfall,comparison,distribution,rectangle
order: 18-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/waterfall/basic-waterfall.png
option: waterfallChart
---

# 基础瀑布图

瀑布图采用绝对值与相对值结合的方式，适用于表达数个特定数值之间的数量变化关系。

## 关键配置

- `total` 配置总计
- `total.valueField` 可以指定当前总计的数值，可以在任意位置放置一个总计，并指定总计值。

## 代码演示

```javascript livedemo
const spec = {
  type: 'waterfall',
  data: {
    id: 'id0',
    values: [
      { x: 'Feb.4', total: true, value: 45 },
      { x: 'Feb.11', y: -5 },
      { x: 'Feb.20', y: 2 },
      { x: 'Feb.25', y: -2 },
      { x: 'Mar.4', y: 2 },
      { x: 'Mar.11', y: 2 },
      { x: 'Mar.19', y: -2 },
      { x: 'Mar.26', y: 1 },
      { x: 'Apr.1', y: 1 },
      { x: 'Apr.8', y: 1 },
      { x: 'Apr.15', y: 2 },
      { x: 'Apr.22', y: 1 },
      { x: 'Apr.29', y: -2 },
      { x: 'May.6', y: -1 },
      { x: 'total', total: true }
    ]
  },
  legends: { visible: true, orient: 'bottom' },
  xField: 'x',
  yField: 'y',
  stackLabel: {
    valueType: 'absolute',
    formatMethod: text => {
      return text + '%';
    }
  },
  seriesFieldName: {
    total: 'total',
    increase: 'increase',
    decrease: 'reduce'
  },
  total: {
    type: 'field',
    tagField: 'total',
    valueField: 'value'
  },
  axes: [
    {
      orient: 'left',
      range: { min: 30, max: 50 },
      title: { visible: true, text: 'favorability' },
      label: {
        formatMethod: v => {
          return v + '%';
        }
      }
    },
    {
      orient: 'bottom',
      label: { visible: true },
      type: 'band',
      paddingInner: 0.4,
      title: { visible: true, text: 'date' }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[瀑布图](link)
