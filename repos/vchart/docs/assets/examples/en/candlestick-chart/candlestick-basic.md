---
category: examples
group: candlestick chart
title: Basic Candlestick Chart
keywords: candlestick
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/candlestick/candlestick-basic.png
option: candlestickChart
---

# Candlestick Chart

Candlestick chart basic usage.

## Key Configurations

- `type: 'candlestick'`
- `openField`, `closeField`, `highField`, `lowField`

## Code demo

```javascript livedemo
// The Candlestick chart needs to be imported from @visactor/vchart-extension.
// import VChartExtension from '@visactor/vchart-extension';
if (VChartExtension.registerCandlestickChart) {
  VChartExtension.registerCandlestickChart();
}

const data = [
  { time: '2024-07-01', open: 100, close: 130, high: 135, low: 90 },
  { time: '2024-07-02', open: 130, close: 80, high: 140, low: 75 },
  { time: '2024-07-03', open: 80, close: 150, high: 155, low: 70 },
  { time: '2024-07-04', open: 150, close: 140, high: 160, low: 105 },
  { time: '2024-07-05', open: 140, close: 170, high: 180, low: 115 },
  { time: '2024-07-06', open: 170, close: 170, high: 175, low: 95 },
  { time: '2024-07-07', open: 170, close: 100, high: 175, low: 95 },
  { time: '2024-07-08', open: 100, close: 160, high: 210, low: 90 }
];

const spec = {
  type: 'candlestick',
  xField: 'time',
  openField: 'open',
  closeField: 'close',
  highField: 'high',
  lowField: 'low',
  data: [
    {
      values: data
    }
  ]
};

const vchart = new VChart(spec, {
  dom: CONTAINER_ID
});
vchart.renderSync();

window['vchart'] = vchart;
```
