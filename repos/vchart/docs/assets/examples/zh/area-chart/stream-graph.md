---
category: examples
group: area chart
title: 河流图
keywords: areaChart,comparison,trend,area,streamgraph,composition
order: 1-10
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/stream-graph.png
option: areaChart
---

# 河流图

河流图是一种堆积面积图。它显示一个数值（Y 轴）跟随另一个数值（X 轴）的演变。这种演变代表了几个群体，所有群体都有不同的颜色。
与堆叠区域相反，没有角落：边缘是圆形的，这给人以流畅的印象。此外，区域通常围绕中心轴移动，从而形成流动的有机形状。
以下示例显示了 1880 年至 2015 年间美国婴儿名字频率的演变。

## 关键配置

- `seriesField` 属性用来声明参与颜色映射的字段
- `stack` 属性声明为 true 用来配置堆叠，会根据 `seriesField` 属性声明的字段进行堆叠
- `stackOffsetSilhouette` 属性声明为 `true`用来配置将系列关于中心线对称放置

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/stream-graph-data.json');
const data = await response.json();

const spec = {
  type: 'area',
  data: {
    id: 'data',
    values: data
  },
  color: ['#F7FCFD', '#E0ECF4', '#BFD3E6', '#9EBCDA', '#8C96C5', '#8C6BB1', '#88419D', '#810F7C', '#4D004A'],
  title: {
    visible: true,
    text: 'EVOLUTION OF BABY NAMES IN THE US'
  },

  xField: 'year',
  yField: 'n',
  seriesField: 'name',
  stackOffsetSilhouette: true,
  point: { visible: false },
  area: {
    style: {
      fillOpacity: 0.4
    },
    state: {
      hover: {
        style: {
          fillOpacity: 1
        }
      }
    }
  },
  legends: [{ range: [], visible: true, position: 'middle', orient: 'bottom' }],

  axes: [
    {
      orient: 'left',
      visible: false
    },
    {
      orient: 'bottom',
      label: { visible: true }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[面积图](link)
