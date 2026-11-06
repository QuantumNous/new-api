---
category: examples
group: marker
title: markLine Specifying Data Points and Calculating Linear Regression
keywords: marker, commonChart
order: 33-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/marker/mark-line-part-regression.png
option: barChart#markLine
---

# markLine Specifying Data Points and Calculating Linear Regression

markLine can further aggregate or regress selected data points.

## Key Configuration

Data point positioning:

- The `coordinates` attribute declares an array of data points or data aggregation values for constructing the markLine polyline. The declaration of data points is `{ xKey: value , yKey: value }`, where `xKey` is the data field corresponding to the x-axis; `yKey` is the data field corresponding to the y-axis; `value` is the value corresponding to the data field or data aggregation type. The aggregation method supports `"variance" | "average" | "min" | "max" | "sum" | "standardDeviation" | "median"`.

Data regression:

- When configuring data points through the `coordinates` attribute, you can further aggregate data points by configuring `process`; When the `process` attribute is configured as `{ xy: "regression" }`, data regression can be performed.

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  xField: 'x',
  yField: 'y',
  axes: [
    {
      orient: 'bottom',
      bandPadding: 0.4
    }
  ],
  label: {
    visible: true,
    style: {
      fill: '#222'
    }
  },
  markLine: [
    {
      coordinates: [
        { x: 1, y: 11.8 },
        { x: 2, y: 18.8 },
        { x: 3, y: 14.4 },
        { x: 4, y: 6.8 },
        { x: 5, y: 1.9 },
        { x: 6, y: 0.8 }
      ],
      process: {
        xy: 'regression'
      },
      label: {
        visible: false
      },
      line: {
        style: {
          stroke: '#F68484',
          lineDash: [],
          lineWidth: 2
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      }
    },
    {
      coordinates: [
        { x: 7, y: 2.5 },
        { x: 8, y: 5.8 },
        { x: 9, y: 7.4 },
        { x: 10, y: 21.8 },
        { x: 11, y: 16.1 },
        { x: 12, y: 15.5 }
      ],
      process: {
        xy: 'regression'
      },
      label: {
        visible: false
      },
      line: {
        style: {
          stroke: '#2CB4A8',
          lineDash: [],
          lineWidth: 2
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      }
    }
  ],
  title: {
    visible: true,
    text: 'Seattle Monthly Precipitation',
    align: 'center'
  },
  bar: {
    style: {
      stroke: '#333',
      fill: 'rgb(124, 182, 215)'
    }
  },
  data: {
    id: 'data2',
    values: [
      { x: 1, y: 11.8 },
      { x: 2, y: 18.8 },
      { x: 3, y: 14.4 },
      { x: 4, y: 6.8 },
      { x: 5, y: 1.9 },
      { x: 6, y: 0.8 },
      { x: 7, y: 2.5 },
      { x: 8, y: 5.8 },
      { x: 9, y: 7.4 },
      { x: 10, y: 21.8 },
      { x: 11, y: 16.1 },
      { x: 12, y: 15.5 }
    ]
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[scrollBar](link)
