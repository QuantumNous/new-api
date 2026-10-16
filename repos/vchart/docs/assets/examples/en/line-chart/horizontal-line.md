---
category: examples
group: line chart
title: Horizontal Line Chart
keywords: lineChart,comparison,trend,line
order: 0-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/line-chart/horizontal-line.png
option: lineChart
---

# Vertical line chart

A line chart with a vertical orientation.

## Key option

- `direction` The property is declared as `horizontal`
- `xField` Property declaration numeric field
- `yField` Property declared as a continuous interval or ordered category field
- `axes` Property set to left axis to `band` Type, the lower side axis is `linear` type

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'value',
  yField: 'time',
  direction: 'horizontal',
  axes: [
    { orient: 'left', type: 'band' },
    { orient: 'bottom', type: 'linear' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Line chart](link)
