---
category: examples
group: layout
title: 轴元素重叠
order: 37-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/layout/grid-layout.png
option: commonChart#layout
---

# 轴元素重叠

在一些场景里，期望多个坐标轴元素能重叠布局，不要独立占位。我们支持在轴上配置 `layoutType: 'region-relative-overlap'`

## 关键配置

- modelId 布局模块的 id 。
- col 元素在第几列。从左向右，从 0 开始计数。
- row 元素在第几行。从上向下，从 0 开始计数。
- colSpan 列方向，当前元素占几列，默认值为 1。
- rowSpan 行方向，当前元素占几行，默认值为 1。

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.7,
          text: '70%'
        }
      ]
    }
  ],
  layout: {
    type: 'grid',
    col: 2,
    row: 1,
    elements: [
      {
        modelId: 'circularProgress',
        col: 1,
        row: 0
      },
      {
        modelId: 'indicator',
        col: 0,
        row: 0
      }
    ]
  },
  region: [
    {
      id: 'circularProgress'
    },
    {
      id: 'indicator'
    }
  ],
  series: [
    {
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'pie',
        values: [
          { type: 'a', value: 30 },
          { type: 'b', value: 70 }
        ]
      },
      seriesField: 'type',
      outerRadius: 0.45,
      innerRadius: 0.4,
      indicator: {
        visible: true,
        title: {
          visible: true,
          autoFit: true,
          style: {
            text: 'max percent'
          }
        },
        content: {
          visible: true,
          autoFit: true,
          style: {
            text: '70%'
          }
        }
      }
    }
  ],
  indicator: [
    {
      regionId: 'indicator',
      visible: true,
      title: {
        style: {
          text: '267',
          dx: -150,
          dy: -100,
          fontSize: 80,
          fontWeight: 800,
          textAlign: 'left'
        }
      },
      content: {
        style: {
          text: 'total number of tags',
          dx: -150,
          dy: -100,
          fill: '#AAA',
          fontSize: 30,
          fontWeight: 600,
          textAlign: 'left'
        }
      }
    },
    {
      regionId: 'indicator',
      visible: true,
      title: {
        style: {
          text: '267',
          dx: -150,
          dy: 100,
          fontSize: 40,
          fontWeight: 800,
          textAlign: 'left'
        }
      },
      content: {
        style: {
          text: 'actual tag',
          dx: -150,
          dy: 100,
          fill: '#AAA',
          fontSize: 30,
          fontWeight: 600,
          textAlign: 'left'
        }
      }
    },
    {
      regionId: 'indicator',
      visible: true,
      title: {
        style: {
          text: '200',
          dx: 100,
          dy: 100,
          fontSize: 40,
          fontWeight: 800,
          textAlign: 'left',
          fill: '#AAA'
        }
      },
      content: {
        style: {
          text: 'offline tag',
          dx: 100,
          dy: 100,
          fill: '#AAA',
          fontSize: 30,
          fontWeight: 600,
          textAlign: 'left'
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[布局](link)
