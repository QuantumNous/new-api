---
category: examples
group: line chart
title: Offline Chart Axis padding adjustment
keywords: lineChart,comparison,trend,line
order: 0-10
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/line-chart/line-axes-padding.png
option: lineChart
---

# folded axes padding adjustment

Adjust the spacing between the ends of the axis by configuring `paddingOuter` and `paddingInner` on the band axis. In this example, we set `paddingInner` to 1 and `paddingOuter` to 0 to remove the white space from the ends of the axis.

## Key configuration

The `bandPadding`, `paddingInner` and `paddingOuter` configurations are provided on the band axis to adjust the axis spacing.

- `bandPadding`: sets both paddingInner and paddingOuter of the axis.
- `paddingInner`: inner margin of the band axis
- `paddingOuter`: outer margin of the band axis

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      { date: '2023-01-01', type: 'Product A', value: 99.9 },
      { date: '2023-01-01', type: 'Product B', value: 96.6 },
      { date: '2023-01-01', type: 'Product C', value: 96.2 },
      { date: '2023-01-02', type: 'Product A', value: 96.7 },
      { date: '2023-01-02', type: 'Product B', value: 91.1 },
      { date: '2023-01-02', type: 'Product C', value: 93.4 },
      { date: '2023-01-03', type: 'Product A', value: 100.2 },
      { date: '2023-01-03', type: 'Product B', value: 99.4 },
      { date: '2023-01-03', type: 'Product C', value: 91.7 },
      { date: '2023-01-04', type: 'Product A', value: 104.7 },
      { date: '2023-01-04', type: 'Product B', value: 108.1 },
      { date: '2023-01-04', type: 'Product C', value: 93.1 },
      { date: '2023-01-05', type: 'Product A', value: 95.6 },
      { date: '2023-01-05', type: 'Product B', value: 96 },
      { date: '2023-01-05', type: 'Product C', value: 92.3 },
      { date: '2023-01-06', type: 'Product A', value: 95.6 },
      { date: '2023-01-06', type: 'Product B', value: 89.1 },
      { date: '2023-01-06', type: 'Product C', value: 92.5 },
      { date: '2023-01-07', type: 'Product A', value: 95.3 },
      { date: '2023-01-07', type: 'Product B', value: 89.2 },
      { date: '2023-01-07', type: 'Product C', value: 95.7 },
      { date: '2023-01-08', type: 'Product A', value: 96.1 },
      { date: '2023-01-08', type: 'Product B', value: 97.6 },
      { date: '2023-01-08', type: 'Product C', value: 99.9 },
      { date: '2023-01-09', type: 'Product A', value: 96.1 },
      { date: '2023-01-09', type: 'Product B', value: 100.6 },
      { date: '2023-01-09', type: 'Product C', value: 103.8 },
      { date: '2023-01-10', type: 'Product A', value: 101.6 },
      { date: '2023-01-10', type: 'Product B', value: 108.3 },
      { date: '2023-01-10', type: 'Product C', value: 108.9 }
    ]
  },
  xField: 'date',
  yField: 'value',
  seriesField: 'type',
  point: {
    visible: false
  },
  line: {
    style: {
      lineWidth: 2
    }
  },
  legends: { visible: true },
  axes: [
    {
      orient: 'bottom',
      // paddingInner: 1,
      // paddingOuter: 0
      trimPadding: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[折线图](link)
