---
category: examples
group: progress
title: 分段条形进度图
keywords: linearProgress,comparison,rectangle
order: 16-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/progress-segment-linear-progress.png
option: linearProgressChart
---

# 分段条形进度图

通过 `extensionMark` 可以实现分段条形图的效果

## 关键配置

- `extensionMark.rule` 实现分段条形图

## 代码演示

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.85,
          goal: 0.7,
          text: '79.5%'
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  seriesField: 'type',
  height: 80,
  cornerRadius: 20,
  progress: {
    style: {
      cornerRadius: 0
    }
  },
  bandWidth: 30,
  axes: [
    {
      orient: 'right',
      type: 'band',
      domainLine: { visible: false },
      tick: { visible: false },
      label: {
        formatMethod: val => '随便写点啥',
        style: {
          fontSize: 16
        }
      }
    },
    {
      orient: 'bottom',
      type: 'linear',
      visible: true,
      grid: {
        visible: false
      },
      label: {
        formatMethod: val => `${val * 100}%`,
        flush: true
      }
    }
  ],
  extensionMark: [
    {
      type: 'rule',
      dataId: 'id0',
      visible: true,
      style: {
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([1 / 3]);
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) - 15;
        },
        x1: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([1 / 3]);
        },
        y1: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) + 15;
        },
        stroke: '#fff',
        lineWidth: 4,
        zIndex: 1
      }
    },
    {
      type: 'rule',
      dataId: 'id0',
      visible: true,
      style: {
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([2 / 3]);
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) - 15;
        },
        x1: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([2 / 3]);
        },
        y1: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) + 15;
        },
        stroke: '#fff',
        lineWidth: 4,
        zIndex: 1
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

[条形进度图](link)
