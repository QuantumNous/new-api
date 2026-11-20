---
category: demo
group: waterfall
title: 堆积瀑布图
keywords: waterfall,comparison,distribution,rectangle
order: 18-3
cover: /vchart/preview/waterfall-stack-waterfall_1.9.0.png
option: waterfallChart
---

# 堆积瀑布图

可以通过一个 `x` 值有多条数据来产生堆积效果。

## 关键配置

- `seriesField` 配置数据分组字段

## 代码演示

```javascript livedemo
const spec = {
  type: 'waterfall',
  data: {
    id: 'id0',
    values: [
      { x: 'First Quarter', y: 10954, type: 'Primary Industry' },
      { x: 'First Quarter', y: 106187, type: 'Secondary Industry' },
      { x: 'First Quarter', y: 153037, type: 'Tertiary Industry' },
      { x: 'Second Quarter', y: 18183, type: 'Primary Industry' },
      { x: 'Second Quarter', y: 122450, type: 'Secondary Industry' },
      { x: 'Second Quarter', y: 151831, type: 'Tertiary Industry' },
      { x: 'Third Quarter', y: 25642, type: 'Primary Industry' },
      { x: 'Third Quarter', y: 121553, type: 'Secondary Industry' },
      { x: 'Third Quarter', y: 160432, type: 'Tertiary Industry' },
      { x: 'Fourth Quarter', y: 33497, type: 'Primary Industry' },
      { x: 'Fourth Quarter', y: 132601, type: 'Secondary Industry' },
      { x: 'Fourth Quarter', y: 169411, type: 'Tertiary Industry' },
      { x: 'Full year', total: true }
    ]
  },
  legends: { visible: true, orient: 'bottom' },
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  total: {
    type: 'field',
    tagField: 'total'
  },
  stackLabel: {
    valueType: 'change'
  },
  title: {
    visible: true,
    text: 'Chinese quarterly GDP in 2022'
  },
  axes: [
    {
      orient: 'left',
      title: { visible: true, text: 'Unit: 100 million yuan' }
    },
    {
      orient: 'bottom',
      label: { visible: true },
      type: 'band',
      paddingInner: 0.4,
      title: { visible: false }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用,不要拷贝
window['vchart'] = vchart;
```

## 相关教程

[瀑布图](link)
