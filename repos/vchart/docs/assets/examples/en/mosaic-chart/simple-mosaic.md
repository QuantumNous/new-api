---
category: examples
group: mosaic chart
title: simple mosaic chart
keywords: mosaic,comparison,distribution,rectangle,composition,proportion
cover: /vchart/preview/mosaic-chart-simple-mosaic_1.11.6.png
option: mosaicChart
---
# Basic Mosaic Chart

Mosaic chart can also be used for ungrouped data to simultaneously display the quantity and proportion of values;

## Key Configurations

- The `label` property configures multiple data labels to display both categories and values

## Code Demo

```javascript livedemo
** --Add the following code when using in business context-- */
// When using in business context, please additionally import registerMosaicChart and execute
// import { registerMosaicChart } from '@visactor/vchart';
// registerMosaicChart();
/** --Add the above code when using in business context-- */

/** --Delete the following code when using in business context-- */
VCHART_MODULE.registerMosaicChart();
/** --Delete the above code when using in business context-- */
const spec = {
  type: 'mosaic',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  label: [
    {
      visible: true,
      position: 'bottom',
      style: {
        fill: '#333'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return datum['month'];
      }
    },
    {
      visible: true,
      position: 'top',
      style: {
        fill: '#333'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return datum['sales'];
      }
    }
  ],
  axes: [
    {
      orient: 'bottom',
      label: {
        visible: false
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
