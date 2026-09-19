---
category: demo
group: crosshair
crosshair/line.md
title: Crosshair Auxiliary Line
keywords: lineChart, comparison, trend, line, crosshair
order: 28-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/crosshair/line.png
option: lineChart#crosshair
---

# Crosshair Auxiliary Line

Crosshair auxiliary lines are used to mark specific data points on a chart, usually triggered by mouse hovering or clicking. The configuration property is `crosshair`. This example demonstrates the default display effect of crosshair.

## Key Configuration

- `bindingAxesIndex`: Declare the binding axis index, with a default of 0
- `defaultSelect`: Declare the default selected data
  - `axisIndex`: Default display of which axis data
  - `datum`: Default display data
- `dimension_hover`: The state when the mouse hovers over a certain dimension

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Round 1', y: 21, c: 'Role A' },
        { x: 'Round 1', y: 38, c: 'Role B' },
        { x: 'Round 2', y: 28, c: 'Role A' },
        { x: 'Round 2', y: 45, c: 'Role B' },
        { x: 'Round 3', y: 22, c: 'Role A' },
        { x: 'Round 3', y: 56, c: 'Role B' },
        { x: 'Round 4', y: 34, c: 'Role A' },
        { x: 'Round 4', y: 48, c: 'Role B' },
        { x: 'Round 5', y: 34, c: 'Role A' },
        { x: 'Round 5', y: 64, c: 'Role B' },
        { x: 'Round 6', y: 44, c: 'Role A' },
        { x: 'Round 6', y: 72, c: 'Role B' },
        { x: 'Round 7', y: 38, c: 'Role A' },
        { x: 'Round 7', y: 65, c: 'Role B' },
        { x: 'Round 8', y: 24, c: 'Role A' },
        { x: 'Round 8', y: 70, c: 'Role B' },
        { x: 'Round 9', y: 28, c: 'Role A' },
        { x: 'Round 9', y: 62, c: 'Role B' }
      ]
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  },
  axes: [
    {
      orient: 'left',
      max: 100
    },
    {
      orient: 'bottom'
    },
    {
      orient: 'right',
      max: 100
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'c',
  point: {
    style: {
      size: 5
    },
    state: {
      dimension_hover: {
        size: 10
      }
    }
  },
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'rect'
      },
      bindingAxesIndex: [1],
      defaultSelect: {
        axisIndex: 1,
        datum: 'Round 6'
      },
      label: {
        visible: true // Default is false
      }
    },
    yField: {
      visible: true,
      bindingAxesIndex: [0, 2],
      defaultSelect: {
        axisIndex: 2,
        datum: 40
      },
      line: {
        style: {
          lineWidth: 1,
          opacity: 1,
          stroke: '#000',
          lineDash: [2, 2]
        }
      },
      label: {
        visible: true // Default is false
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation related to this demo configuration.
