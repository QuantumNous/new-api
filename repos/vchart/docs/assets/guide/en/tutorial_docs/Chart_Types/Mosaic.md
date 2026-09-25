# Mosaic Chart

[\[Options\]](../../../option/mosaic)

## Introduction

Mosaic chart, also known as Mosaic Plot, is a special type of stacked bar chart that displays data percentages in groups; it is commonly used in the field of statistics.

A 2-dimensional mosaic chart is an extension of the percentage stacked bar chart, showing not only the percentage information within stacked categories but also the percentage distribution between stacked categories.

![mosaic-chart](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-guide/mosaic-chart.png)

### Chart Components

The configuration of a mosaic chart is similar to that of a bar chart, consisting of rectangular elements, axes, and other components.

Here are some essential configurations:

- `type`: Chart type, set to `'mosaic'`
- `data`: Data source for the chart
- `xField`: Categorical field mapping to the x-coordinate / width of the elements
- `yField`: Numeric field mapping to the height / y-coordinate of the elements

- For more component configurations, refer to [VChart MosaicChart Options](../../../option/mosaic)

### Quick Start

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
    }
    // {
    //   orient: 'bottom',
    //   label: {
    //     visible: false
    //   }
    // }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
### Key Configurations

- The `type` property sets the chart type to `'mosaic'`

## Characteristics of Mosaic Chart

### Data

Mosaic chart is used to display data with two dimensions

- Two `discrete` fields, such as: `product`, `type`
- One `numeric` field, such as: `sales`

Example reference:

```ts
data: [
  {
    name: 'bar',
    values: [
      {
        product: '数码产品',
        type: 'a',
        sales: 20
      },
      {
        product: '数码产品',
        type: 'b',
        sales: 20
      },
      {
        product: '日用品',
        sales: 50
      },
      {
        product: '食品',
        sales: 80
      }
    ]
  }
];
```
Note: Similar to percentage stacked charts, mosaic charts generally do not recommend having negative numbers.

### Mosaic Chart without Grouping Fields

When displaying data without grouping fields in a mosaic chart, it defaults to not stacking percentages, but only showing a percentage display of the categorical dimension, which is an extension of the basic bar chart:

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
### Axes

The default configuration of the x-axis for a horizontal mosaic chart is as follows:

- The default scale type for the x-axis is `linear`, with labels not displayed by default. It is recommended to display label values using the `label` property.
```ts
{
  orient: 'bottom',
  type: 'linear',
  label: {
    visible: false
  }
} as ICartesianAxisSpec;
```

- The default configuration of the y-axis is as follows:

```ts
return {
  orient: 'left',
  type: 'linear'
} as ICartesianAxisSpec;
```
