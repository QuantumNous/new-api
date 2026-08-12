---
category: demo
group: axis
title: 多层级坐标轴
keywords: barChart,axis
order: 25-18
cover: /vchart/preview/multiple-layers-of-axis_1.9.0.png
option: barChart#axes
---

# 多层级坐标轴（实例 1）

当图表存在多层分组时，可以通过为 band 轴开启 `showAllGroupLayers` 属性，绘制多层级标签的坐标轴

## 关键配置

- 为对应方向的轴配置： `showAllGroupLayers: true`
- 通过 `layers` 属性，关闭第一层轴标签 `layers: [{ visible: false }]`

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      name: 'data1',
      values: [
        {
          name: 'Product 1',
          industry: 'E-commerce',
          type: 'Contract amount',
          y: 88
        },
        {
          name: 'Product 1',
          industry: 'E-commerce',
          type: 'Paid for',
          y: 40
        },
        {
          name: 'Product 1',
          industry: 'E-commerce',
          type: 'Receivables',
          y: 78
        },
        {
          name: 'Product 1',
          industry: 'Game',
          type: 'Contract amount',
          y: 96
        },
        {
          name: 'Product 1',
          industry: 'Game',
          type: 'Paid for',
          y: 70
        },
        {
          name: 'Product 1',
          industry: 'Game',
          type: 'Receivables',
          y: 86
        },
        {
          name: 'Product 2',
          industry: 'E-commerce',
          type: 'Contract amount',
          y: 96
        },
        {
          name: 'Product 2',
          industry: 'E-commerce',
          type: 'Paid for',
          y: 45
        },
        {
          name: 'Product 2',
          industry: 'E-commerce',
          type: 'Receivables',
          y: 67
        },
        {
          name: 'Product 2',
          industry: 'Game',
          type: 'Contract amount',
          y: 89
        },
        {
          name: 'Product 2',
          industry: 'Game',
          type: 'Paid for',
          y: 34
        },
        {
          name: 'Product 2',
          industry: 'Game',
          type: 'Receivables',
          y: 50
        }
      ]
    }
  ],
  xField: ['name', 'industry', 'type'],
  yField: 'y',
  seriesField: 'type',
  barGapInGroup: 0,
  axes: [
    {
      orient: 'bottom',
      showAllGroupLayers: true,
      layers: [
        {
          visible: false
        }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
