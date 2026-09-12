---
category: demo
group: crosshair
title: 玫瑰图的 crosshair
keywords: roseChart,comparison,circle,crosshair
order: 28-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/crosshair/polar-rect.png
option: roseChart#crosshair
---

# 玫瑰图的 crosshair

## 关键配置

- `crosshair.categoryField` 配置维度数据的 crosshair，一般为角度轴，角度轴的 line 支持 'line' 和 'rect' 形状
- `crosshair.valueField` 配置指标数据的 crosshair，一般为半径轴，line 只支持 'line'

## 代码演示

```javascript livedemo
const data = [
  { country: 'China', cost: 96 },
  { country: 'Germany', cost: 121 },
  { country: 'USA', cost: 100 },
  { country: 'Japan', cost: 111 },
  { country: 'South Korea', cost: 102 },
  { country: 'France', cost: 124 },
  { country: 'Italy', cost: 123 },
  { country: 'Netherlands', cost: 111 },
  { country: 'Belgium', cost: 123 },
  { country: 'UK', cost: 109 },
  { country: 'Canada', cost: 115 },
  { country: 'Russia', cost: 99 },
  { country: 'Mexico', cost: 91 },
  { country: 'India', cost: 87 },
  { country: 'Switzerland', cost: 125 },
  { country: 'Australia', cost: 130 },
  { country: 'Spain', cost: 109 },
  { country: 'Brazil', cost: 123 },
  { country: 'Thailand', cost: 91 },
  { country: 'Indonesia', cost: 83 },
  { country: 'Poland', cost: 101 },
  { country: 'Sweden', cost: 116 },
  { country: 'Austria', cost: 111 },
  { country: 'Czech Republic', cost: 107 }
];

const spec = {
  type: 'rose',
  data: [
    {
      id: 'rose',
      values: data
    }
  ],
  categoryField: 'country',
  valueField: 'cost',
  seriesField: 'country',
  outerRadius: 0.75, // set the radius
  axes: [
    {
      animation: true,
      orient: 'angle',
      visible: true,
      label: {
        visible: true
      },
      domainLine: {
        visible: true
      },
      grid: {
        visible: true
      },
      sampling: false
    },
    {
      orient: 'radius',
      visible: true,
      domainLine: {
        visible: true
      },
      grid: {
        visible: true
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'right',
    type: 'color',
    field: 'cost',
    title: {
      visible: true,
      text: `country's cost`
    }
  },
  rose: {
    style: {
      fill: {
        field: 'cost',
        scale: 'color'
      },
      // Set the rounded corners of the sector
      cornerRadius: 8
    }
  },
  color: {
    type: 'linear',
    domain: [
      {
        dataId: 'rose',
        fields: ['cost']
      }
    ],
    range: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603']
  },
  crosshair: {
    categoryField: {
      visible: true,
      line: {
        type: 'rect',
        style: {
          fill: '#91d5ff'
        }
      },
      label: {
        visible: true // default is false
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
