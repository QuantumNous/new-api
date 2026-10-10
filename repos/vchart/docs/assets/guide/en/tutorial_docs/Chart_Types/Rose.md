# Rose Chart

[\[Configuration Manual\]](../../../option/roseChart)

## Introduction

A rose chart is a statistical chart drawn under the polar coordinate system, in which each category in the data is divided into equal parts, and the distance extending outward from the center of each part depends on the value it represents. The rose chart is suitable for displaying cyclical data (months, seasons, etc.) and has been used by British statistician Florence Nightingale to display the number of soldiers who died during the Crimean War.

In VChart, the difference between a rose chart and a pie chart is that **a pie chart uses the angle range of the sector to represent the difference in values while the radius of the sector remains consistent**, while **a rose chart uses the radius of the sector to represent the difference in values while the angle range of the sector remains consistent**. It's the sectors with different radii that make up the beautifully staggered "rose petals".

## Chart Composition

The rose chart consists of sector elements and other components.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda08.png)

Sector elements are the basic elements of a rose chart, and related drawing configurations are essential:

- `roseChart.type`: Chart type, pie/doughnut chart type is `'rose'`
- `roseChart.data`: Data source for chart drawing
- `roseChart.categoryField`: Category field, mapping different sector elements
- `roseChart.valueField`: Value field, mapping the radius of the element's sector
- `roseChart.seriesField`: Category field, mapping the color of the element's sector

Axes, tooltips, and other components that assist in chart display are optional configurations with default effects and functionality:

- `roseChart.axes`: Axes component, displayed by default and automatically infers the coordinate system and data mapping logic according to the chart type, for detailed configuration see [VChart Axes Component Configuration](../../../option/roseChart#axes)
- `roseChart.tooltip`: Tooltip, displayed by default when interactive, for detailed configurations see [VChart Tooltip Component Configuration](../../../option/roseChart#tooltip)
- For more component configurations, see [VChart roseChart configuration](../../../option/roseChart)

## Rose Chart Features

### Data

- A `discrete` field, such as: `product`, used to map different sectors
- A `value` field, such as: `sales`, used to map the sector's radius

A set of product category and sales data definition is as follows:

```ts
data: [
  {
    name: 'rose',
    values: [
      {
        product: 'Digital Products',
        sales: 20
      },
      {
        product: 'Daily Necessities',
        sales: 50
      },
      {
        product: 'Food',
        sales: 80
      }
    ]
  }
];
```

### Grouped Rose Chart

A grouped rose chart can be seen as a **'bent grouped bar chart'**, which arranges different categories of rose series in a spaced manner along the polar coordinate system, with each group of rose series representing a category.

In VChart, you need to append fields to `categoryField` (at this point, `categoryField` exists as an array), which are used to distinguish data categories, i.e., to split a single rose series dimensionally and expand it in a spaced manner. And to distinguish the spaced columns in the same dimension, you need to specify the `roseChart.seriedField` field, which by default maps the sector color.

```javascript livedemo
const data = {
  id: '0',
  values: [
    {
      time: '2:00',
      value: 27,
      type: 'sales'
    },
    {
      time: '6:00',
      value: 25,
      type: 'sales'
    },
    {
      time: '10:00',
      value: 18,
      type: 'sales'
    },
    {
      time: '14:00',
      value: 15,
      type: 'sales'
    },
    {
      time: '18:00',
      value: 10,
      type: 'sales'
    },
    {
      time: '22:00',
      value: 5,
      type: 'sales'
    },
    {
      time: '2:00',
      value: 7,
      type: 'count'
    },
    {
      time: '6:00',
      value: 5,
      type: 'count'
    },
    {
      time: '10:00',
      value: 38,
      type: 'count'
    },
    {
      time: '14:00',
      value: 5,
      type: 'count'
    },
    {
      time: '18:00',
      value: 20,
      type: 'count'
    },
    {
      time: '22:00',
      value: 15,
      type: 'count'
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
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Stacked Rose Chart

A stacked rose chart can be seen as a **'bent stacked bar chart'**, which combines different categories of rose series in a stacked manner, with each group of rose series representing a category.
In VChart, if you want to display a stacked rose chart, you need to configure `roseChart.stack: true`, and to distinguish the stacked sectors within the same dimension, you need to specify the `roseChart.seriedField` field, which by default maps the sector color.

Auxiliary components for chart display, such as tooltips, are optional configurations with default effects and functionality:

- `roseChart.tooltip`: Tooltip, displayed by default when interactive, for detailed configurations see [VChart Tooltip Component Configuration](../../option/roseChart#tooltip)
- For more component configurations, see [VChart Component Configuration](../../option/roseChart)

```javascript livedemo
const spec = {
  type: 'rose',
  data: [
    {
      values: [
        {
          time: '12814',
          month: 'Jan',
          level: '0-3'
        },
        {
          time: '3054',
          month: 'Jan',
          level: '3-6'
        },
        {
          time: '4376',
          month: 'Jan',
          level: '6-9'
        },
        {
          time: '4229',
          month: 'Jan',
          level: '9-12'
        },

        {
          time: '8814',
          month: 'Feb',
          level: '0-3'
        },
        {
          time: '5067',
          month: 'Feb',
          level: '3-6'
        },
        {
          time: '13987',
          month: 'Feb',
          level: '6-9'
        },
        {
          time: '3932',
          month: 'Feb',
          level: '9-12'
        },

        {
          time: '11624',
          month: 'Mar',
          level: '0-3'
        },
        {
          time: '7004',
          month: 'Mar',
          level: '3-6'
        },
        {
          time: '3574',
          month: 'Mar',
          level: '6-9'
        },
        {
          time: '5221',
          month: 'Mar',
          level: '9-12'
        },

        {
          time: '8814',
          month: 'Apr',
          level: '0-3'
        },
        {
          time: '9054',
          month: 'Apr',
          level: '3-6'
        },
        {
          time: '4376',
          month: 'Apr',
          level: '6-9'
        },
        {
          time: '5256',
          month: 'Apr',
          level: '9-12'
        },

        {
          time: '9998',
          month: 'May',
          level: '0-3'
        },
        {
          time: '5043',
          month: 'May',
          level: '3-6'
        },
        {
          time: '4572',
          month: 'May',
          level: '6-9'
        },
        {
          time: '3308',
          month: 'May',
          level: '9-12'
        },

        {
          time: '12321',
          month: 'Jun',
          level: '0-3'
        },
        {
          time: '15067',
          month: 'Jun',
          level: '3-6'
        },
        {
          time: '3417',
          month: 'Jun',
          level: '6-9'
        },
        {
          time: '5432',
          month: 'Jun',
          level: '9-12'
        }
      ]
    }
  ],
  categoryField: 'month',
  valueField: 'time',
  seriesField: 'level',
  outerRadius: 1,
  stack: true,
  title: {
    visible: true,
    text: 'Wind speed statistics for the first half of the year'
  },
  legends: [{ visible: true, position: 'middle', orient: 'left' }],
  color: ['#FFB84C', '#F266AB', '#A459D1', '#2CD3E1'],
  axes: [
    {
      orient: 'angle',
      domainLine: { visible: true, smooth: true },
      label: { visible: true },
      tick: { visible: true },
      grid: { visible: true },
      bandPadding: 0.05
    },
    {
      orient: 'radius',
      label: { visible: true },
      grid: { visible: true, smooth: true }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
