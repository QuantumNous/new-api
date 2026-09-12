---
category: examples
group: mosaic chart
title: basic mosaic chart
keywords: mosaic,comparison,distribution,rectangle,composition,proportion
cover: /vchart/preview/mosaic-chart-basic-mosaic_1.11.6.png
option: mosaicChart
---
# Basic Mosaic Chart

Mosaic chart, also known as Mosaic Plot in English, is a special type of stacked bar chart that displays data percentages in groups; it can be seen as an extension of the percentage bar chart.

## Key Configurations

- The `label` property configures various labels

## Code Demo
```javascript livedemo
/** --Add the following code when using in business context-- */
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
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],

  label: [
    {
      visible: true,
      position: 'bottom',
      style: {
        fill: '#333'
      },
      filterByGroup: {
        field: 'State',
        type: 'min'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return datum['State'];
      }
    },

    {
      visible: true,
      position: 'top',
      style: {
        fill: '#333'
      },
      filterByGroup: {
        field: 'State',
        type: 'max'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return `${datum['__VCHART_STACK_END']} ( ${(
          (datum['__VCHART_MOSAIC_CAT_END_PERCENT'] - datum['__VCHART_MOSAIC_CAT_START_PERCENT']) *
          100
        ).toFixed(0)}% )`;
      }
    },
    {
      visible: true,
      position: 'center',
      smartInvert: true
    }
  ],
  xField: 'State',
  yField: 'Population',
  seriesField: 'Age',
  percent: true,
  legends: {
    visible: true
  },
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod: val => {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    },
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
