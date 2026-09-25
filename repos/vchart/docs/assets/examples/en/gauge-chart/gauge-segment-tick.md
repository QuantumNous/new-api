---
category: examples
group: gauge
title: Segmented Gauge Chart with Tick Mask
keywords: gauge,comparison,circle
order: 15-6
cover: /vchart/preview/gauge-segment-tick_1.4.2.png
option: gaugeChart
---

# Segmented Gauge Chart with Tick Mask

## Key option

- `categoryField`,`valueField` Properties are used to specify data categories and pointer angle fields, respectively
- `innerRadius`,`outerRadius` Property is used to specify the inner and outer radii of the dashboard
- `startAngle`,`endAngle` Properties are used to specify the start and end angles of the dashboard
- `gauge` Property can be configured[Background panel series for gauge chart](../../option/gaugeChart#gauge)
- `tickMask` Property can be used to configure the tick mask on the chart background

## Demo source

```javascript livedemo
const spec = {
  type: 'gauge',
  data: [
    {
      id: 'pointer',
      values: [
        {
          type: 'A',
          value: 0.6
        }
      ]
    },
    {
      id: 'segment',
      values: [
        {
          type: 'level1',
          value: 0.4
        },
        {
          type: 'level2',
          value: 0.6
        },
        {
          type: 'level3',
          value: 0.8
        }
      ]
    }
  ],
  gauge: {
    type: 'gauge',
    dataIndex: 1,
    categoryField: 'type',
    valueField: 'value',
    seriesField: 'type',
    tickMask: {
      visible: true,
      angle: 3,
      offsetAngle: 0,
      forceAlign: true,
      style: {
        cornerRadius: 15
      }
    }
  },
  pointer: {
    style: {
      fill: '#666666'
    }
  },
  categoryField: 'type',
  valueField: 'value',
  outerRadius: 0.8,
  innerRadius: 0.5,
  startAngle: -180,
  endAngle: 0,
  axes: [{ type: 'linear', orient: 'angle', grid: { visible: false } }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Gauge chart](link)
