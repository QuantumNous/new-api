---
category: examples
group: bar chart
title: 水平条形图标签位置自定义
keywords: barChart,comparison,distribution,label,rectangle
cover: /vchart/preview/bar-functional-position_1.6.0.png
option: barChart
---

# 水平条形图标签位置自定义

在柱状图中，通过配置 `label.position` 可以自定义标签位置。

## 关键配置

- `label.position` 属性配置为函数，函数参数为相关图元的数据，返回值为根据数据确定的标签位置。

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  height: 300,
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', year: '2000', value: 16727 },
        { type: 'B', year: '2000', value: 12546 },
        { type: 'C', year: '2000', value: 11085 },
        { type: 'D', year: '2000', value: 13506 },
        { type: 'E', year: '2000', value: 5765 },
        { type: 'A', year: '2010', value: 5546 },
        { type: 'B', year: '2010', value: 1505 },
        { type: 'C', year: '2010', value: 8375 },
        { type: 'D', year: '2010', value: 3375 },
        { type: 'E', year: '2010', value: 5960 }
      ]
    }
  ],
  barWidth: 20,
  yField: 'year',
  xField: 'value',
  legends: {},
  label: {
    visible: true,
    position: datum => {
      return datum.year === '2000' ? 'top-right' : 'bottom-right';
    },
    overlap: { strategy: [], clampForce: false },
    offset: 0,
    style: {
      fill: 'rgb(115,125,135)',
      fontSize: 12
    }
  },
  direction: 'horizontal',
  seriesField: 'type',
  axes: [
    {
      orient: 'bottom',
      paddingInner: 0.3
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
