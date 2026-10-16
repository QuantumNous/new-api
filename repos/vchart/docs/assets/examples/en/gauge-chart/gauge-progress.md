---
category: examples
group: gauge
title: Gauge Chart with CircularProgress Series
keywords: gauge,comparison,circle
order: 15-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/57a706137957fce7388f3ab0b.png
option: gaugeChart
---

# Gauge Chart with CircularProgress Series

## Key option

- `categoryField`,`valueField` Properties are used to specify data categories and pointer angle fields, respectively
- `innerRadius`,`outerRadius` Property is used to specify the inner and outer radii of the dashboard
- `startAngle`,`endAngle` Properties are used to specify the start and end angles of the dashboard
- `gauge`Properties can be configured[Background panel series for gauge chart](../../option/gaugeChart#gauge)

## Demo source

```javascript livedemo
const spec = {
  type: 'gauge',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: '目标A',
          value: 0.7
        }
      ]
    }
  ],
  radiusField: 'type',
  categoryField: 'type',
  valueField: 'value',
  outerRadius: 0.8,
  innerRadius: 0.75,
  startAngle: -240,
  endAngle: 60,
  gauge: {
    type: 'circularProgress',
    cornerRadius: 20,
    progress: {
      style: {
        fill: '#1664ff'
      }
    },
    track: {
      style: {
        fill: '#000'
      }
    }
  },
  pointer: {
    style: {
      fill: '#333'
    }
  },
  indicator: [
    {
      visible: true,
      offsetY: '70%',
      title: {
        style: {
          text: '70%',
          fontSize: 60,
          fontWeight: 800
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Gauge chart](link)
