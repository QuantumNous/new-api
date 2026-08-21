# Range Area Chart

[\[Configuration Manual\]](../../../option/rangeAreaChart)

## Introduction

The Range Area Chart (Range Area Chart) is a visual encoding graphic used to display the differences between different datasets. In the range area chart, you can clearly see the changes in the minimum value field and maximum value field between each dataset, as well as the gap between them. This type of chart is often used to display the fluctuation range, uncertainty, and trends of data. In VChart, you can easily configure and generate such charts.

## Composition of the Chart

Similar to the area chart, the range area chart is composed of area chart elements, coordinate axes, and other components.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a06.png)

The rectangular chart element is the basic element of the range area chart, and related drawing configurations are essential:

- `rangeAreaChart.type`: Chart type, the type of bar / bar chart is `'rangeArea'`
- `rangeAreaChart.data`: Data source for chart drawing
- `rangeAreaChart.xField`: Category field, mapping the x-coordinate of the chart element
- `rangeAreaChart.yField`: Value field array, mapping the lower and upper boundaries of the chart element, i.e., representing the minimum and maximum values of the data

Coordinate axes, tooltips, and other components serve as auxiliary chart display components and are optional configurations with default effects and functions:

- `rangeAreaChart.axes`: Coordinate axis component, displayed by default and automatically infers the coordinate system and data mapping logic based on the chart type, detailed configuration see [VChart Coordinate Axis Component Configuration](../../../option/rangeAreaChart#axes)
- `rangeAreaChart.tooltip`: Tooltip, displayed by default when interacting, detailed configuration see [VChart Tooltip Component Configuration](../../../option/rangeAreaChart#tooltip)
- For more component configurations, see [VChart rangeAreaChart Configuration](../../../option/rangeAreaChart)

## Getting Started Quickly

```javascript livedemo
const spec = {
  type: 'rangeArea',
  data: [
    {
      id: 'areaData',
      values: [
        { type: 'Category One', min: 76, max: 100 },
        { type: 'Category Two', min: 56, max: 108 },
        { type: 'Category Three', min: 38, max: 129 },
        { type: 'Category Four', min: 58, max: 155 },
        { type: 'Category Five', min: 45, max: 120 },
        { type: 'Category Six', min: 23, max: 99 },
        { type: 'Category Seven', min: 18, max: 56 },
        { type: 'Category Eight', min: 18, max: 34 }
      ]
    }
  ],
  type: 'rangeArea',
  dataIndex: 0,
  xField: 'type',
  yField: ['min', 'max'],
  stack: false,
  area: {
    style: {
      fillOpacity: 0.15
    }
  },
  axes: [
    {
      orient: 'left',
      label: {
        visible: true
      },
      type: 'linear'
    },
    { orient: 'bottom', type: 'band' }
  ],
  crosshair: {
    xField: { visible: true }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Key Configurations

- The `yField` property is configured as an array consisting of the minimum value numeric attribute and the maximum value numeric attribute.

## Range Area Chart Features

### Data

- A `discrete` field, e.g., `x`
- Two `numeric` fields, e.g., `min` and `max`

Data is defined as follows:

```ts
data: [
  {
    name: 'rangeColumn',
    values: [
      {
        x: 'A',
        min: 5,
        max: 8
      },
      {
        x: 'B',
        min: 5,
        max: 8
      },
      {
        x: 'C',
        min: 5,
        max: 8
      }
    ]
  }
];
```

### Combined Range Area Chart and Line Chart

Since the range area chart can only display the maximum and minimum values of each dimension, in order to display the overall trend of the data, the range area chart is usually combined with the line chart.

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'areaData',
      values: [
        { type: 'Category One', min: 76, max: 100 },
        { type: 'Category Two', min: 56, max: 108 },
        { type: 'Category Three', min: 38, max: 129 },
        { type: 'Category Four', min: 58, max: 155 },
        { type: 'Category Five', min: 45, max: 120 },
        { type: 'Category Six', min: 23, max: 99 },
        { type: 'Category Seven', min: 18, max: 56 },
        { type: 'Category Eight', min: 18, max: 34 }
      ]
    },
    {
      id: 'lineData',
      values: [
        { type: 'Category One', average: 88 },
        { type: 'Category Two', average: 82 },
        { type: 'Category Three', average: 83.5 },
        { type: 'Category Four', average: 106.5 },
        { type: 'Category Five', average: 82.5 },
        { type: 'Category Six', average: 61 },
        { type: 'Category Seven', average: 37 },
        { type: 'Category Eight', average: 26 }
      ]
    }
  ],
  series: [
    {
      type: 'rangeArea',
      dataIndex: 0,
      xField: 'type',
      yField: ['min', 'max'],
      stack: false,
      area: {
        style: {
          fillOpacity: 0.15
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      xField: 'type',
      yField: 'average',
      point: {
        state: {
          hover: {
            fillOpacity: 0.5,
            stroke: 'blue',
            lineWidth: 2
          },
          selected: {
            fill: 'red'
          }
        }
      }
    }
  ],

  axes: [
    {
      orient: 'left',
      label: {
        visible: true
      },
      type: 'linear'
    },
    { orient: 'bottom', type: 'band' }
  ],
  crosshair: {
    xField: { visible: true }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```
