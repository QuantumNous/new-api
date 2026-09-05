---
category: examples
group: progress
title: Linear progress chart with text labeling
keywords: linearProgress,comparison,rectangle
order: 16-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/progress-linear-progress-with-text.png
option: linearProgressChart
---

# Linear progress charts with text labeling

The `extensionMark` allows you to add the necessary text markup to the bar.

## Key configuration

- `extensionMark.text` implements text markup.
- `extensionMark.rule` Realizing the goal line

## Demo source

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.795,
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
  height: 150,
  cornerRadius: 20,
  bandWidth: 30,
  axes: [
    {
      orient: 'right',
      type: 'band',
      domainLine: { visible: false },
      tick: { visible: false },
      label: {
        formatMethod: val => '16,068,954.13',
        style: {
          fontSize: 30,
          fontWeight: 'bold',
          fill: '#000'
        }
      },
      maxWidth: '60%' // 配置坐标轴的最大空间
    },
    {
      orient: 'bottom',
      label: { visible: true, inside: true },
      type: 'linear',
      visible: false,
      grid: {
        visible: false
      }
    }
  ],

  extensionMark: [
    {
      type: 'text',
      dataId: 'id0',
      visible: true,
      style: {
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([0]);
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) - 15;
        },
        fontSize: 14,
        fill: '#000',
        text: '销售额',
        textAlign: 'start',
        textBaseline: 'bottom',
        dy: -12
      }
    },
    {
      type: 'text',
      dataId: 'id0',
      visible: true,
      style: {
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([0]);
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) + 15;
        },
        maxLineWidth: (datum, ctx, elements, dataView) => {
          const length = ctx.valueToX([1]) - ctx.valueToX([0]);
          return length;
        },
        fontSize: 12,
        fill: '#999',
        text: '当前值 16,068,954.13 / 目标值 25,000,000.00 / 最大值 30,000,000.00',
        textAlign: 'start',
        textBaseline: 'top',
        dy: 12
      }
    },
    {
      type: 'rule',
      dataId: 'id0',
      visible: true,
      style: {
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([datum.goal]);
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) - 15;
        },
        x1: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([datum.goal]);
        },
        y1: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) + 15;
        },
        stroke: 'red',
        lineWidth: 2
      }
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[LinearProgress Chart](link)
