---
category: examples
group: bar chart
title: 分组柱状图间隔
keywords: barChart,comparison,distribution,rank,rectangle
order: 2-12
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/55297520732ada18bb7183f00.png
option: barChart
---

# 分组柱状图间隔

## 关键配置

- `type: bar` 属性声明为柱形图
- `xField` 属性声明为分类字段或时序字段
- `yField` 属性声明为数值字段
- `axes.paddingInner`属性声明为柱间隔

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  color: ['#becef3', '#6a8edc', '#77caeb', '#52c93b', '#d3f5e8'],
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', year: '2000', value: 25 },
        { type: 'A', year: '2010', value: 28 },
        { type: 'A', year: '2018', value: 18 },
        { type: 'B', year: '2000', value: 23 },
        { type: 'B', year: '2010', value: 32 },
        { type: 'B', year: '2018', value: 22 },
        { type: 'C', year: '2000', value: 18 },
        { type: 'C', year: '2010', value: 18 },
        { type: 'C', year: '2018', value: 18 },
        { type: 'D', year: '2000', value: 15 },
        { type: 'D', year: '2010', value: 22 },
        { type: 'D', year: '2018', value: 19 },
        { type: 'E', year: '2000', value: 5 },
        { type: 'E', year: '2010', value: 12 },
        { type: 'E', year: '2018', value: 5 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  axes: [
    {
      orient: 'bottom',
      paddingInner: 0.3
    }
  ],
  bar: {
    style: {
      fillOpacity: 0.9
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
