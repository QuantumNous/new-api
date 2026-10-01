---
category: examples
group: progress
title: Circular Progress Chart with Tick Mask
keywords: circularProgress,comparison,circle,indicator
order: 16-6
cover: /vchart/preview/circular-progress-tick_1.4.2.png
option: circularProgressChart
---

# Circular Progress Chart with Tick Mask

The circular progress chart is a chart type under the polar coordinate system. It can display the percentage values of multiple indicators side by side, suitable for evaluating the progress of target achievement. Essentially, there is only one difference between the circular progress chart and the rose chart: the radial axis of the rose chart is a continuous axis, and the angular axis is a discrete axis; while the radial axis of the circular progress chart is a discrete axis, and the angular axis is a continuous axis. Circular progress charts can display the percentage values of multiple indicators side by side, suitable for evaluating the progress of target achievement.

## When to use

1. Display the progress of target achievement.
2. Compare the size of the progress of target achievements in different categories.

## Key configuration

- `categoryField` and `valueField` properties are used to specify the data category and arc angle field respectively
- `innerRadius` and `outerRadius` properties are used to specify the inner and outer radius of the progress chart
- `tickMask` Property can be used to configure the tick mask on the chart background

## Demo source

```javascript livedemo
const spec = {
  type: 'circularProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.795,
          text: '79.5%'
        },
        {
          type: 'Business Companies',
          value: 0.5,
          text: '50%'
        },
        {
          type: 'Customer-facing Companies',
          value: 0.25,
          text: '25%'
        }
      ]
    }
  ],
  color: ['rgb(255, 222, 0)', 'rgb(171, 205, 5)', 'rgb(0, 154, 68)'],
  valueField: 'value',
  categoryField: 'type',
  seriesField: 'type',
  radius: 0.8,
  innerRadius: 0.4,
  tickMask: {
    visible: true,
    angle: 10,
    offsetAngle: 0,
    forceAlign: true,
    style: {
      cornerRadius: 15
    }
  },
  axes: [
    {
      visible: false,
      type: 'linear',
      orient: 'angle'
    },
    {
      visible: false,
      type: 'band',
      orient: 'radius'
    }
  ],
  indicator: {
    visible: true,
    trigger: 'hover',
    title: {
      visible: true,
      field: 'type',
      autoLimit: true,
      style: {
        fontSize: 20,
        fill: 'black'
      }
    },
    content: [
      {
        visible: true,
        field: 'text',
        style: {
          fontSize: 16,
          fill: 'gray'
        }
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'bottom',
    title: {
      visible: false
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related tutorials

[Pie chart](link)
