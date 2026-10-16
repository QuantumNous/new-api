---
category: examples
group: histogram chart
title: 基础直方图
keywords: histogram,distribution,rectangle
order: 3-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/histogram-chart/histogram-bin_2.0.7.png
option: histogramChart
---

# Basic Histogram

This example demonstrates how to use binning to process raw data and generate a basic histogram. By configuring `xField`, `x2Field`, and `yField`, you can specify the start, end, and frequency fields of each bin, respectively.

## Key Configuration Details

- `xField`: Specifies the left endpoint field of each bin (e.g., `x0`).
- `x2Field`: Specifies the right endpoint field of each bin (e.g., `x1`).
- `yField`: Specifies the frequency field for each bin (e.g., `frequency`).

With these configurations, you can convert detailed data into the binned statistical data required for a histogram, enabling visualization of data distribution.

## 代码演示

```javascript livedemo
const spec = {
  data: [
    {
      name: 'data1',
      transforms: [
        {
          type: 'bin',
          options: {
            step: 2,
            field: 'value',
            outputNames: { x0: 'x0', x1: 'x1', count: 'frequency' }
          }
        }
      ],
      values: [
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 4 },
        { value: 4 },
        { value: 4 },
        { value: 4 },
        { value: 4 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 7 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 }
      ]
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'frequency',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Histogram by bin transform'
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'frequency'
      },
      content: [
        {
          key: datum => datum['x0'] + '～' + datum['x1'],
          value: datum => datum['frequency']
        }
      ]
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
