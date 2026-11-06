---
category: demo
group: waterfall
title: 分解瀑布图
keywords: waterfall,comparison,distribution,rectangle
order: 18-1
cover: /vchart/preview/waterfall-collect-waterfall_1.9.0.png
option: waterfallChart
---

# 分解瀑布图

可以通过 `total.collectCountField` 对部分数据进行总计，可以用于展示某阶段的总计信息。

## 关键配置

- `total.collectCountField` 配置总计计算，计算包含前 n 个维度值数据

## 代码演示

```javascript livedemo
const spec = {
  type: 'waterfall',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'First Quarter-Primary Industry', y: 10954, type: 'Primary Industry' },
        { x: 'First Quarter-Secondary Industry', y: 106187, type: 'Secondary Industry' },
        { x: 'First Quarter-Tertiary Industry', y: 153037, type: 'Tertiary Industry' },
        { x: 'First Quarter', total: true, collect: 3 },
        { x: 'Second Quarter-Primary Industry', y: 18183, type: 'Primary Industry' },
        { x: 'Second Quarter-Secondary Industry', y: 122450, type: 'Secondary Industry' },
        { x: 'Second Quarter-Tertiary Industry', y: 151831, type: 'Tertiary Industry' },
        { x: 'Second Quarter', total: true, collect: 3 },
        { x: 'Third Quarter-Primary Industry', y: 25642, type: 'Primary Industry' },
        { x: 'Third Quarter-Secondary Industry', y: 121553, type: 'Secondary Industry' },
        { x: 'Third Quarter-Tertiary Industry', y: 160432, type: 'Tertiary Industry' },
        { x: 'Third Quarter', total: true, collect: 3 },
        { x: 'Fourth Quarter-Primary Industry', y: 33497, type: 'Primary Industry' },
        { x: 'Fourth Quarter-Secondary Industry', y: 132601, type: 'Secondary Industry' },
        { x: 'Fourth Quarter-Tertiary Industry', y: 169411, type: 'Tertiary Industry' },
        { x: 'Fourth Quarters', total: true, collect: 3 },
        { x: 'Full year', total: true }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  total: {
    type: 'field',
    tagField: 'total',
    startField: 'start',
    valueField: 'value',
    collectCountField: 'collect'
  },
  stackLabel: {
    valueType: 'change'
  },
  title: {
    visible: true,
    text: 'Chinese Quarterly GDP in 2022'
  },
  legends: { visible: true, orient: 'bottom' },
  axes: [
    { orient: 'left', title: { visible: true, text: 'unit: 100 million yuan' } },
    {
      orient: 'bottom',
      label: {
        visible: true,
        formatMethod: text => {
          const arr = text.split('-');
          return arr[arr.length - 1];
        }
      },
      type: 'band',
      paddingInner: 0.4
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
