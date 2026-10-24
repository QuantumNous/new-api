---
category: examples
group: progress
title: Linear progress chart with target value
keywords: linearProgress,comparison,rectangle
order: 16-2
cover: /vchart/preview/linear-progress-with-target-value_1.5.3.png
option: linearProgressChart
---

# Linear progress chart with target value

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
        },
        {
          type: 'Business Companies',
          value: 0.25,
          goal: 0.9,
          text: '25%'
        },
        {
          type: 'Customer-facing Companies',
          value: 0.065,
          goal: 0.8,
          text: '6.5%'
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  seriesField: 'type',

  cornerRadius: 20,
  bandWidth: 30,
  axes: [
    {
      orient: 'left',
      label: { visible: true },
      type: 'band',
      domainLine: { visible: false },
      tick: { visible: false }
    },
    { orient: 'bottom', label: { visible: true }, type: 'linear', visible: false }
  ],
  extensionMark: [
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
    },
    {
      type: 'symbol',
      dataId: 'id0',
      visible: true,
      style: {
        symbolType: 'triangleDown',
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToX([datum.goal]);
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.type]) - 22;
        },
        size: 20,
        scaleY: 0.5,
        fill: 'red'
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
