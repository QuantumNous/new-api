---
category: demo
group: axis
title: Multi-axis sync
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-15
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/axis-sync.png
option: barChart#axes
---

# Multi-axis sync

We provide `sync` configuration for multiple axes, which can be used to configure 0 value alignment or tick proportional alignment of multiple axes.

## Key Configuration

Configure the axes in the corresponding direction on the `axes` attribute:

- The `id` attribute, used as the unique identifier of the axis
- Configure the `sync.tickAlign` property to `true` to enable tick synchronization of the axis component.

## Demo source

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

## Related Tutorials

Attach links to tutorials or API documentation associated with this demo configuration.
