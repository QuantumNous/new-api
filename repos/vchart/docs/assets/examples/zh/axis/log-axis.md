---
category: demo
group: axis
title: log轴
keywords: lineChart,comparison,composition,trend,axis
order: 25-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/ffc3a9b5518762d274121ff06.jpeg
option: lineChart#axes
---

# log 轴

在图表绘制中，log 轴是一种用于显示数据的坐标轴。与常规的线性（linear）轴不同，log 轴使用对数刻度而不是线性刻度。这种方式可以在显示一定范围内的大数据范围时更好地展示数据。

log 轴的特点是刻度之间的间隔是根据对数函数（通常是以 10 为底）计算的。这意味着数据的每个对数单位（大小单位）具有相同的物理长度，例如从 1 到 10、10 到 100、100 到 1000 等。对于数据的指数增长或指数下降情况，log 轴能够更好地显示数据的相对变化。

## 关键配置

在 `axes` 属性上配置坐标轴类型：

- `type` 属性设置为`'log'`，用于配制坐标轴类型

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 2,
    row: 6,
    rowHeight: [
      {
        index: 0,
        size: 30
      },
      {
        index: 3,
        size: 20
      }
    ],
    elements: [
      {
        modelId: 'title',
        col: 1,
        row: 0
      },
      {
        modelId: 'line-region-A',
        col: 1,
        row: 1
      },
      {
        modelId: 'axis-left-A',
        col: 0,
        row: 1
      },
      {
        modelId: 'axis-bottom-A',
        col: 1,
        row: 2
      },
      {
        modelId: 'line-region-B',
        col: 1,
        row: 4
      },
      {
        modelId: 'axis-left-B',
        col: 0,
        row: 4
      },
      {
        modelId: 'axis-bottom-B',
        col: 1,
        row: 5
      }
    ]
  },
  region: [
    {
      id: 'line-region-A'
    },
    {
      id: 'line-region-B'
    }
  ],
  series: [
    {
      regionId: 'line-region-A',
      type: 'line',
      xField: 'time',
      yField: 'a',
      data: {
        id: 'line-A',
        values: [
          {
            time: 1,
            a: 0,
            b: 117,
            c: 145
          },
          {
            time: 10,
            a: 1,
            b: 1317,
            c: 2345
          },
          {
            time: 100,
            a: 2,
            b: 2500,
            c: 3100
          },
          {
            time: 1000,
            a: 3,
            b: 7500,
            c: 6100
          },
          {
            time: 10000,
            a: 4,
            b: 7500,
            c: 6100
          },
          {
            time: 100000,
            a: 5,
            b: 7500,
            c: 6100
          },
          {
            time: 1000000,
            a: 6,
            b: 7500,
            c: 6100
          }
        ]
      }
    },
    {
      regionId: 'line-region-B',
      type: 'line',
      xField: 'time',
      yField: 'a',
      data: {
        id: 'line-B',
        values: [
          {
            time: 1,
            a: 0,
            b: 117,
            c: 145
          },
          {
            time: 10,
            a: 1,
            b: 1317,
            c: 2345
          },
          {
            time: 100,
            a: 2,
            b: 2500,
            c: 3100
          },
          {
            time: 1000,
            a: 3,
            b: 7500,
            c: 6100
          },
          {
            time: 10000,
            a: 4,
            b: 7500,
            c: 6100
          },
          {
            time: 100000,
            a: 5,
            b: 7500,
            c: 6100
          },
          {
            time: 1000000,
            a: 6,
            b: 7500,
            c: 6100
          }
        ]
      }
    }
  ],
  title: {
    text: 'the example shows difference of linear axis and log axis',
    id: 'title'
  },
  axes: [
    {
      id: 'axis-left-A',
      regionId: 'line-region-A',
      orient: 'left',
      type: 'linear'
    },

    {
      id: 'axis-bottom-A',
      regionId: 'line-region-A',
      orient: 'bottom',
      type: 'linear',
      title: 'log-axis'
    },
    {
      id: 'axis-left-B',
      regionId: 'line-region-B',
      orient: 'left',
      type: 'linear'
    },

    {
      id: 'axis-bottom-B',
      regionId: 'line-region-B',
      orient: 'bottom',
      type: 'log',
      title: 'log-axis'
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
