# Range Column Chart

[\[Configuration Manual\]](../../../option/rangeColumnChart)

## Introduction

A range column chart is a type of bar chart used to represent data changes within a period or a fixed interval. Its main feature is that each bar represents a range rather than a single data point, usually showing the range of data changes on the horizontal axis and the quantity of the interval on the vertical axis. Range column charts are suitable for displaying data that changes over time, such as sales or inventory changes, as well as for showing the distribution of data within a specific time period, such as temperature data or salary distributions.

## Chart Composition

Similar to bar charts, range column charts are composed of rectangular chart elements, axes, and other components.
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf07.png)

Rectangular chart elements are essential for range column charts, and related drawing configurations are indispensable:

- `rangeColumnChart.type`: Chart type, the type of column / bar chart is `'rangeColumn'`
- `rangeColumnChart.data`: Data source for chart drawing
  When `rangeColumnChart.direction: vertical`
- `rangeColumnChart.xField`: Categorical field, mapping the x-coordinate of the chart element
- `rangeColumnChart.yField`: Array of numeric fields, mapping the lower and upper bounds of the chart element, i.e., representing the minimum and maximum values of the data
  When `rangeColumnChart.direction: vertical`
- `rangeColumnChart.xField`: Array of numeric fields, mapping the left and right boundaries of the chart element, i.e., representing the minimum and maximum values of the data
- `rangeColumnChart.yField`: Categorical field, mapping the y-coordinate of the chart element

Axes, tooltips, and other components that assist in chart display are optional configurations with default effects and features:

- `rangeColumnChart.axes`: Axis component, the default display automatically infers the coordinate system and data mapping logic according to the chart type, detailed configuration can be found in [VChart Axis Component Configuration](../../../option/rangeColumnChart#axes)
- `rangeColumnChart.tooltip`: Tooltip, default interactive display, detailed configuration can be found in [VChart Tooltip Component Configuration](../../../option/rangeColumnChart#tooltip)
- More component configurations can be found in [VChart rangeColumnChart Configuration](../../../option/rangeColumnChart)

### Quick Start

```javascript livedemo
const spec = {
  type: 'rangeColumn',
  data: [
    {
      values: [
        { type: '分类一', min: 76, max: 100 },
        { type: '分类二', min: 56, max: 108 },
        { type: '分类三', min: 38, max: 129 },
        { type: '分类四', min: 58, max: 155 },
        { type: '分类五', min: 45, max: 120 },
        { type: '分类六', min: 23, max: 99 },
        { type: '分类七', min: 18, max: 56 },
        { type: '分类八', min: 18, max: 34 }
      ]
    }
  ],
  xField: 'type',
  yField: ['min', 'max'],
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Range Column Chart Features

### Data

- One `discrete` field, e.g.: `x`
- Two `numeric` fields, e.g.: `min` `max`

The data definition is as follows:

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

### Label Position

The overall configuration of range column charts is similar to that of bar charts, but since each bar represents a range of values, labels are usually needed for information assistance. In VChart, there are four label layout types for range column charts: `rangeColumnChart.label.position: 'middle' | 'start' | 'end' | 'bothEnd'`, which represent labels placed in the middle, at the start point, at the end point, and at both ends, with the default being `'middle'`.

```javascript livedemo
const spec = {
  type: 'rangeColumn',
  data: [
    {
      id: 'data0',
      values: [
        { type: '分类一', min: 76, max: 100 },
        { type: '分类二', min: 56, max: 108 },
        { type: '分类三', min: 38, max: 129 },
        { type: '分类四', min: 58, max: 155 },
        { type: '分类五', min: 45, max: 120 },
        { type: '分类六', min: 23, max: 99 },
        { type: '分类七', min: 18, max: 56 },
        { type: '分类八', min: 18, max: 34 }
      ]
    }
  ],
  direction: 'horizontal',
  yField: 'type',
  xField: ['min', 'max'],
  label: {
    visible: true,
    position: 'bothEnd' // 两端
    // position: 'start', // 起点
    // position: 'end', // 终点
    // position: 'middle', // 中间
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
