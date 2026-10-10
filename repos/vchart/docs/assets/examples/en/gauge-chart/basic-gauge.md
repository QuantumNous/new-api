---
category: examples
group: gauge
title: Basic Gauge Chart
keywords: gauge,comparison,circle
order: 15-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/gauge-chart/basic-gauge.png
option: gaugeChart
---

# Basic Gauge Chart

Gauge charts are a type of skeuomorphic chart, similar to a car's speedometer, where the scale represents a measurement and the pointer angle represents the current value.

## Key option

- The `categoryField` and `valueField` properties are used to specify the data category and pointer angle fields respectively
- The `innerRadius` and `outerRadius` properties are used to specify the inner and outer radii of the gauge
- The `startAngle` and `endAngle` properties are used to specify the starting and ending angles of the gauge

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
          value: 0.6
        }
      ]
    }
  ],
  categoryField: 'type',
  valueField: 'value',
  outerRadius: 0.8,
  innerRadius: 0.5,
  startAngle: -180,
  endAngle: 0
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Gauge Chart](link)
