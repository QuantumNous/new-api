---
category: examples
group: rose
title: 分组玫瑰图
keywords: roseChart,comparison,composition,circle
order: 7-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/rose-chart/rose-grouped.png
option: roseChart
---

# 分组玫瑰图

与直角坐标系下的柱状图类似，玫瑰图支持通过设置 categoryField 字段为数组进行分组。

## 关键配置

- `categoryField`属性指定用于分组的字段，支持字符串和数组。在这个例子中，根据数据中的 time 和 type 字段进行分组
- `seriesField`字段用于划分不同系列
- `axes`字段用于设置极坐标轴的标签、刻度线等属性

## 代码演示

```javascript livedemo
const data = {
  id: '0',
  values: [
    {
      time: '2:00',
      value: 27,
      type: 'Sales'
    },
    {
      time: '6:00',
      value: 25,
      type: 'Sales'
    },
    {
      time: '10:00',
      value: 18,
      type: 'Sales'
    },
    {
      time: '14:00',
      value: 15,
      type: 'Sales'
    },
    {
      time: '18:00',
      value: 10,
      type: 'Sales'
    },
    {
      time: '22:00',
      value: 5,
      type: 'Sales'
    },
    {
      time: '2:00',
      value: 7,
      type: 'Discount'
    },
    {
      time: '6:00',
      value: 5,
      type: 'Discount'
    },
    {
      time: '10:00',
      value: 38,
      type: 'Discount'
    },
    {
      time: '14:00',
      value: 5,
      type: 'Discount'
    },
    {
      time: '18:00',
      value: 20,
      type: 'Discount'
    },
    {
      time: '22:00',
      value: 15,
      type: 'Discount'
    }
  ]
};

const spec = {
  type: 'rose',
  data,
  categoryField: ['time', 'type'],
  valueField: 'value',
  seriesField: 'type',
  outerRadius: 0.9,
  axes: [
    {
      orient: 'angle',
      domainLine: { visible: true },
      grid: { visible: true, alignWithLabel: false },
      label: {
        visible: true
      }
    },
    {
      orient: 'radius',
      grid: { visible: true, smooth: true }
    }
  ],
  crosshair: {
    categoryField: {
      visible: true,
      line: {
        type: 'rect'
      }
    },
    label: {
      visible: true // label 默认关闭
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[玫瑰图](link)
