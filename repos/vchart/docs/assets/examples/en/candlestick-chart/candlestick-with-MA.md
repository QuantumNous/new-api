---
category: examples
group: candlestick chart
title: Candlestick Chart with MA
keywords: candlestick MA
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/candlestick/candlestick-with-MA.png
option: candlestickChart
---

# Candlestick Chart with MA

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
  { time: '2024-07-08', open: 100, close: 160, high: 210, low: 90 },
  { time: '2024-07-09', open: 160, close: 180, high: 200, low: 150 },
  { time: '2024-07-10', open: 180, close: 175, high: 190, low: 160 },
  { time: '2024-07-11', open: 175, close: 190, high: 195, low: 170 },
  { time: '2024-07-12', open: 190, close: 210, high: 220, low: 185 },
  { time: '2024-07-13', open: 210, close: 200, high: 215, low: 195 },
  { time: '2024-07-14', open: 200, close: 220, high: 225, low: 198 },
  { time: '2024-07-15', open: 220, close: 230, high: 240, low: 215 }
];

function calcMA(data, window) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push({ time: data[i].time, ma: null });
    } else {
      let sum = 0;
      for (let j = 0; j < window; j++) {
        sum += data[i - j].close;
      }
      result.push({ time: data[i].time, ma: sum / window });
    }
  }
  return result;
}

const spec = {
  type: 'common',
  data: [
    { id: 'k', values: data },
    { id: 'ma5', values: calcMA(data, 5) }
  ],
  series: [
    {
      id: 'candlestick',
      type: 'candlestick',
      dataIndex: 0,
      xField: 'time',
      yField: ['open', 'close', 'high', 'low'],
      openField: 'open',
      closeField: 'close',
      highField: 'high',
      lowField: 'low'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      xField: 'time',
      yField: 'ma',
      line: {
        style: {
          stroke: 'rgb(229, 193, 160)',
          lineWidth: 2
        }
      },
      point: {
        visible: false
      }
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0, 1] },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ]
};

const vchart = new VChart(spec, {
  dom: CONTAINER_ID
});
vchart.renderSync();

window['vchart'] = vchart;
```
