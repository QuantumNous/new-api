---
category: demo
group: axis
title: 轴同步
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-15
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/axis-sync.png
option: barChart#axes
---

# 轴同步

我们为多轴提供了 `sync` 配置，可以用来配置多轴的 0 值对齐，或者 tick 比例对齐。

## 关键配置

在 `axes` 属性上为对应方向的轴配置：

- `id` 属性，用来作为轴的唯一标识
- `sync.tickAlign` 属性配置为 `true` 来开启轴组件的 tick 同步。

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', y: 15 },
        { x: 'Tuesday', y: 12 },
        { x: 'Wednesday', y: 15 },
        { x: 'Thursday', y: 10 },
        { x: 'Friday', y: 13 },
        { x: 'Saturday', y: 10 },
        { x: 'Sunday', y: 20 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', y: -52 },
        { x: 'Tuesday', y: -43 },
        { x: 'Wednesday', y: -33 },
        { x: 'Thursday', y: -22 },
        { x: 'Friday', y: -10 },
        { x: 'Saturday', y: -30 },
        { x: 'Sunday', y: -50 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      stack: false,
      label: { visible: true },
      xField: 'x',
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0], id: 'axisLeft', nice: false, zero: false },
    {
      orient: 'right',
      seriesId: ['line'],
      grid: { visible: false },
      nice: false,
      zero: false,
      sync: { axisId: 'axisLeft', tickAlign: true }
    },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
