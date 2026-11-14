---
category: demo
group: axis
title: Multi-level axis
keywords: barChart,axis
Order: 25-19
cover: /vchart/preview/multiple-layers-of-axis-1_1.9.0.png
option: barChart#axes
---

# Multi-level coordinate axes (example 2)

When the chart has multiple levels of grouping, you can draw the coordinate axes of multi-level labels by turning on the `showAllGroupLayers` attribute for the band axis.

## Key option

Configure the axis in the corresponding direction: `showAllGroupLayers: true`

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      values: [
        { type: 'Category One', min: 76, max: 100, range: 'A', type2: 'p', color: 'A_p' },
        { type: 'Category Two', min: 56, max: 108, range: 'A', type2: 'p', color: 'A_p' },
        { type: 'Category One', min: 56, max: 100, range: 'B', type2: 'p', color: 'B_p' },
        { type: 'Category Two', min: 36, max: 108, range: 'B', type2: 'p', color: 'B_p' },

        { type: 'Category One', min: 76, max: 100, range: 'A', type2: 'k', color: 'A_k' },
        { type: 'Category Two', min: 56, max: 108, range: 'A', type2: 'k', color: 'A_k' },
        { type: 'Category One', min: 56, max: 100, range: 'B', type2: 'k', color: 'B_k' },
        { type: 'Category Two', min: 36, max: 108, range: 'B', type2: 'k', color: 'B_k' }
      ]
    }
  ],
  xField: ['type', 'range', 'type2'],
  yField: 'min',
  seriesField: 'color',
  paddingInner: [0.6, 0.6, 0.6],
  bandPadding: [0.6, 0.6, 0.6],
  label: {
    position: 'bothEnd'
  },
  axes: [
    {
      orient: 'bottom',
      showAllGroupLayers: true,
      sampling: false,
      tick: {
        tickCount: 2
      }
    }
  ],
  legends: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
