---
category: examples
group: gauge
title: Gauge Chart with Gauge Series
keywords: gauge,comparison,circle
order: 15-4
cover: /vchart/preview/gauge-segment_1.4.2.png
option: gaugeChart
---

# Gauge Chart with Gauge Series

## Key option

- `categoryField`,`valueField` Properties are used to specify data categories and pointer angle fields, respectively
- `innerRadius`,`outerRadius` Property is used to specify the inner and outer radii of the dashboard
- `startAngle`,`endAngle` Properties are used to specify the start and end angles of the dashboard
- `gauge`Properties can be configured[Background panel series for gauge chart](../../option/gaugeChart#gauge)
- `centerY` Set the y-coordinate of the center
- `layoutRadius` Set the layout radius
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
          type: 'Level 1',
          color: '#07A35A',
          value: 0.4
        },
        {
          type: 'Level 2',
          color: '#FFC528',
          value: 0.6
        },
        {
          type: 'Level 3',
          color: '#E33232',
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
    segment: {
      style: {
        cornerRadius: 10,
        fill: datum => datum['color']
      }
    },
    label: {
      visible: true,
      position: 'inside-outer',
      offsetRadius: 10,
      style: {
        text: datum => datum['type']
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
  outerRadius: 0.9,
  innerRadius: 0.6,
  startAngle: -180,
  endAngle: 0,
  centerY: '100%',
  layoutRadius: 'auto',
  axes: [
    {
      type: 'linear',
      orient: 'angle',
      inside: true,
      grid: { visible: false }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Gauge chart](link)
