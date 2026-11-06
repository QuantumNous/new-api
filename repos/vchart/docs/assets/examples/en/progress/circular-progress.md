---
category: examples
group: progress
title: Circular Progress Chart
keywords: circularProgress,comparison,circle,indicator
order: 16-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/progress/circular-progress.png
option: circularProgressChart
---

# Circular Progress Chart

The circular progress chart is a chart type under the polar coordinate system. It can display the percentage values of multiple indicators side by side, suitable for evaluating the progress of target achievement. Essentially, there is only one difference between the circular progress chart and the rose chart: the radial axis of the rose chart is a continuous axis, and the angular axis is a discrete axis; while the radial axis of the circular progress chart is a discrete axis, and the angular axis is a continuous axis. Circular progress charts can display the percentage values of multiple indicators side by side, suitable for evaluating the progress of target achievement.

## When to use

1. Display the progress of target achievement.
2. Compare the size of the progress of target achievements in different categories.

## Key configuration

- `categoryField` and `valueField` properties are used to specify the data category and arc angle field respectively
- `innerRadius` and `outerRadius` properties are used to specify the inner and outer radius of the progress chart

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
          value: 0.25,
          text: '25%'
        },
        {
          type: 'Customer-facing Companies',
          value: 0.065,
          text: '6.5%'
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  seriesField: 'type',
  radius: 0.8,
  innerRadius: 0.5,
  roundCap: true,
  cornerRadius: 20,
  progress: {
    style: {
      innerPadding: 5,
      outerPadding: 5
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
    orient: 'right',
    title: {
      visible: false
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related tutorials

[Pie chart](link)
