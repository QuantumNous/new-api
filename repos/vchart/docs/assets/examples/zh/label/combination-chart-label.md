---
category: examples
group: label
title: 组合图标签
keywords: label
order: 35-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/label/combination-chart-label.png
option: commonChart#series-line.label
---

# 组合图标签

在图表中，标签是对当前图形所展示数据的信息标注，可以用于解释说明图形的一些数据含义，例如数值、名称等；

## 关键配置

在图元上配置纹理相关的属性即可：

- `label`: 标签配置。
  - `visible`: 显示标签。
  - `style`: 标签样式配置。
  - `position`：标签位置配置。
  - `overlap`：标签防重叠配置。
- 本例是一个有 3 个区域的组合图，其中第一行的两个折线图均有 2 个系列。通常，我们标签躲避是默认单个系列进行计算的，若需要以 region 的范围进行标签躲避，可以配置`labelLayout: 'region'`。

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  stackField: 'stack',
  seriesField: 'type',
  layout: {
    type: 'grid',
    col: 9,
    row: 9,
    colWidth: [
      {
        index: 0,
        size: 50
      },
      {
        index: 4,
        size: 50
      },
      {
        index: 8,
        size: 50
      }
    ],
    rowHeight: [
      {
        index: 0,
        size: 50
      },
      {
        index: 4,
        size: 50
      },
      {
        index: 8,
        size: 50
      }
    ],
    elements: [
      {
        modelId: 'legend0',
        col: 2,
        row: 3
      },
      {
        modelId: 'legend1',
        col: 6,
        row: 3
      },
      {
        modelId: 'legend2',
        col: 2,
        row: 7
      },
      {
        modelId: 'region0',
        col: 2,
        row: 1
      },
      {
        modelId: 'region1',
        col: 6,
        row: 1
      },
      {
        modelId: 'region2',
        col: 2,
        row: 5
      },
      {
        modelId: 'axesLeft0',
        col: 1,
        row: 1
      },
      {
        modelId: 'axesLeft1',
        col: 5,
        row: 1
      },
      {
        modelId: 'axesRight0',
        col: 3,
        row: 1
      },
      {
        modelId: 'axesRight1',
        col: 7,
        row: 1
      },
      {
        modelId: 'axesRight2',
        col: 3,
        row: 5
      },
      {
        modelId: 'axesBottom0',
        col: 2,
        row: 2
      },
      {
        modelId: 'axesBottom1',
        col: 6,
        row: 2
      },
      {
        modelId: 'axesBottom2',
        col: 2,
        row: 6
      }
    ]
  },
  region: [
    {
      id: 'region0'
    },
    {
      id: 'region1'
    },
    {
      id: 'region2'
    }
  ],
  legends: [
    {
      visible: true,
      orient: 'bottom',
      id: 'legend0',
      position: 'start',
      regionIndex: [0],
      item: {
        visible: true
      }
    },
    {
      visible: true,
      orient: 'bottom',
      id: 'legend1',
      position: 'start',
      regionIndex: [1],
      item: {
        visible: true
      }
    },
    {
      visible: true,
      orient: 'bottom',
      id: 'legend2',
      position: 'start',
      regionIndex: [2],
      item: {
        visible: true
      }
    }
  ],
  labelLayout: 'region',
  series: [
    {
      type: 'line',
      data: {
        id: 'A',
        values: [
          {
            x: 0,
            y: 13,
            type: 'A'
          },
          {
            x: 1,
            y: 42,
            type: 'A'
          },
          {
            x: 2,
            y: 159,
            type: 'A'
          },
          {
            x: 3,
            y: 135,
            type: 'A'
          },
          {
            x: 4,
            y: 66,
            type: 'A'
          },
          {
            x: 5,
            y: 43,
            type: 'A'
          },
          {
            x: 6,
            y: 280,
            type: 'A'
          },
          {
            x: 7,
            y: 200,
            type: 'A'
          },
          {
            x: 8,
            y: 16,
            type: 'A'
          },
          {
            x: 9,
            y: 109,
            type: 'A'
          }
        ]
      },
      regionIndex: 0,
      label: { visible: true },
      id: 'line0',
      xField: 'x',
      yField: 'y',
      seriesField: 'type'
    },
    {
      type: 'line',
      data: {
        id: 'B',
        values: [
          {
            x: 0,
            y: 67,
            type: 'B'
          },
          {
            x: 1,
            y: 268,
            type: 'B'
          },
          {
            x: 2,
            y: 175,
            type: 'B'
          },
          {
            x: 3,
            y: 179,
            type: 'B'
          },
          {
            x: 4,
            y: 41,
            type: 'B'
          },
          {
            x: 5,
            y: 142,
            type: 'B'
          },
          {
            x: 6,
            y: 142,
            type: 'B'
          },
          {
            x: 7,
            y: 236,
            type: 'B'
          },
          {
            x: 8,
            y: 215,
            type: 'B'
          },
          {
            x: 9,
            y: 196,
            type: 'B'
          }
        ]
      },
      regionIndex: 0,
      id: 'line1',
      xField: 'x',
      yField: 'y',
      seriesField: 'type',
      label: { visible: true }
    },
    {
      type: 'line',
      data: {
        id: 'C',
        values: [
          {
            x: 0,
            y: 55,
            type: 'C'
          },
          {
            x: 1,
            y: 136,
            type: 'C'
          },
          {
            x: 2,
            y: 265,
            type: 'C'
          },
          {
            x: 3,
            y: 106,
            type: 'C'
          },
          {
            x: 4,
            y: 154,
            type: 'C'
          },
          {
            x: 5,
            y: 86,
            type: 'C'
          },
          {
            x: 6,
            y: 89,
            type: 'C'
          },
          {
            x: 7,
            y: 104,
            type: 'C'
          },
          {
            x: 8,
            y: 100,
            type: 'C'
          },
          {
            x: 9,
            y: 166,
            type: 'C'
          }
        ]
      },
      regionIndex: 1,
      id: 'line2',
      xField: 'x',
      yField: 'y',
      seriesField: 'type',
      label: { visible: true }
    },
    {
      type: 'line',
      data: {
        id: 'D',
        values: [
          {
            x: 0,
            y: 124,
            type: 'D'
          },
          {
            x: 1,
            y: 242,
            type: 'D'
          },
          {
            x: 2,
            y: 182,
            type: 'D'
          },
          {
            x: 3,
            y: 179,
            type: 'D'
          },
          {
            x: 4,
            y: 143,
            type: 'D'
          },
          {
            x: 5,
            y: 291,
            type: 'D'
          },
          {
            x: 6,
            y: 248,
            type: 'D'
          },
          {
            x: 7,
            y: 90,
            type: 'D'
          },
          {
            x: 8,
            y: 74,
            type: 'D'
          },
          {
            x: 9,
            y: 291,
            type: 'D'
          }
        ]
      },
      regionIndex: 1,
      id: 'line3',
      xField: 'x',
      yField: 'y',
      seriesField: 'type',
      label: { visible: true }
    },
    {
      type: 'line',
      data: {
        id: 'E',
        values: [
          {
            x: 0,
            y: 13,
            type: 'E'
          },
          {
            x: 1,
            y: 243,
            type: 'E'
          },
          {
            x: 2,
            y: 282,
            type: 'E'
          },
          {
            x: 3,
            y: 252,
            type: 'E'
          },
          {
            x: 4,
            y: 217,
            type: 'E'
          },
          {
            x: 5,
            y: 282,
            type: 'E'
          },
          {
            x: 6,
            y: 49,
            type: 'E'
          },
          {
            x: 7,
            y: 26,
            type: 'E'
          },
          {
            x: 8,
            y: 115,
            type: 'E'
          },
          {
            x: 9,
            y: 114,
            type: 'E'
          }
        ]
      },
      regionIndex: 2,
      id: 'line4',
      xField: 'x',
      yField: 'y',
      seriesField: 'type',
      // 配置标签在图形上方，关闭防重叠
      label: { visible: true, position: 'top', overlap: false }
    }
  ],
  axes: [
    {
      orient: 'left',
      regionIndex: 0,
      seriesId: 'line0',
      id: 'axesLeft0'
    },
    {
      orient: 'left',
      regionIndex: 1,
      seriesId: 'line2',
      id: 'axesLeft1'
    },
    {
      orient: 'right',
      regionIndex: 0,
      seriesId: 'line1',
      id: 'axesRight0'
    },
    {
      orient: 'right',
      regionIndex: 1,
      seriesId: 'line3',
      id: 'axesRight1'
    },
    {
      orient: 'right',
      regionIndex: 2,
      seriesId: 'line4',
      id: 'axesRight2'
    },
    {
      orient: 'bottom',
      label: {
        visible: true
      },
      regionIndex: [0],
      id: 'axesBottom0'
    },
    {
      orient: 'bottom',
      label: {
        visible: true
      },
      regionIndex: [1],
      id: 'axesBottom1'
    },
    {
      orient: 'bottom',
      title: {
        visible: true,
        style: {
          text: '标题1'
        }
      },
      regionIndex: [2],
      id: 'axesBottom2'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[散点图](link)
