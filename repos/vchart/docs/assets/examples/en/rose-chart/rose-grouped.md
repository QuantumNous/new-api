---
category: examples
group: rose
title: Grouped Rose Chart
keywords: roseChart,comparison,composition,circle
order: 7-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/rose-chart/rose-grouped.png
option: roseChart
---

# Grouped Rose Chart

Similar to the bar chart in the Cartesian coordinate system, the rose chart supports grouping by setting the `categoryField` field to an array.

## Key option

- The `categoryField` property specifies the field used for grouping, supporting both strings and arrays. In this example, grouping is done based on the `time` and `type` fields in the data
- The `seriesField` field is used to divide different series
- The `axes` field is used to set the properties of polar coordinate axis labels, tick lines, etc.

## Demo source

```javascript livedemo
const data = {
  id: '0',
  values: [
    {
      time: '2:00',
      value: 27,
      type: '销售额'
    },
    {
      time: '6:00',
      value: 25,
      type: '销售额'
    },
    {
      time: '10:00',
      value: 18,
      type: '销售额'
    },
    {
      time: '14:00',
      value: 15,
      type: '销售额'
    },
    {
      time: '18:00',
      value: 10,
      type: '销售额'
    },
    {
      time: '22:00',
      value: 5,
      type: '销售额'
    },
    {
      time: '2:00',
      value: 7,
      type: '折扣'
    },
    {
      time: '6:00',
      value: 5,
      type: '折扣'
    },
    {
      time: '10:00',
      value: 38,
      type: '折扣'
    },
    {
      time: '14:00',
      value: 5,
      type: '折扣'
    },
    {
      time: '18:00',
      value: 20,
      type: '折扣'
    },
    {
      time: '22:00',
      value: 15,
      type: '折扣'
    }
  ]
};

const spec = {
  type: 'rose',
  data,
  categoryField: ['time', 'type'],
  valueField: 'value',
  seriesField: 'type',
  outerRadius: 0.9,
  axes: [
    {
      orient: 'angle',
      domainLine: { visible: true },
      grid: { visible: true, alignWithLabel: false },
      label: {
        visible: true
      }
    },
    {
      orient: 'radius',
      grid: { visible: true, smooth: true }
    }
  ],
  crosshair: {
    categoryField: {
      visible: true,
      line: {
        type: 'rect'
      }
    },
    label: {
      visible: true // label defaukt close
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorial

[Rose Chart](link)
