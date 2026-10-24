# How to define the mapping relationship of the axes for the combination of line chart and stacked column chart?

## Question Description

In a column-line combination chart, there are 2 lines. I hope that the lower line and the column correspond to the left axis, and the top one corresponds to the right axis first. How should I configure it in vchart?

## Solution

In VChart, the axis and series can flexibly configure the corresponding relationship. The seriesId configured on the axis can be configured as an array of series ids or a single series id

1. Divide the line data into two parts. If there are already two parts, you don’t need to process them. Assume that their IDs are line0 and line1 respectively, and the ID of the column is bar0.
2. Set the seriesId of the left axis to ['line0','bar0'] and the seriesId of the right axis to ['line1'].

## Code Example

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'data0',
      values: [
        { x: 'Monday', type: 'Breakfast', y: 15 },
        { x: 'Monday', type: 'Lunch', y: 25 },
        { x: 'Tuesday', type: 'Breakfast', y: 12 },
        { x: 'Tuesday', type: 'Lunch', y: 30 },
        { x: 'Wednesday', type: 'Breakfast', y: 15 },
        { x: 'Wednesday', type: 'Lunch', y: 24 },
        { x: 'Thursday', type: 'Breakfast', y: 10 },
        { x: 'Thursday', type: 'Lunch', y: 25 },
        { x: 'Friday', type: 'Breakfast', y: 13 },
        { x: 'Friday', type: 'Lunch', y: 20 },
        { x: 'Saturday', type: 'Breakfast', y: 10 },
        { x: 'Saturday', type: 'Lunch', y: 22 },
        { x: 'Sunday', type: 'Breakfast', y: 12 },
        { x: 'Sunday', type: 'Lunch', y: 19 }
      ]
    },
    {
      id: 'data1',
      values: [
        { x: 'Monday', type: 'Wine', y: 22 },
        { x: 'Tuesday', type: 'Wine', y: 23 },
        { x: 'Wednesday', type: 'Wine', y: 13 },
        { x: 'Thursday', type: 'Wine', y: 12 },
        { x: 'Friday', type: 'Wine', y: 10 },
        { x: 'Saturday', type: 'Wine', y: 20 },
        { x: 'Sunday', type: 'Wine', y: 10 }
      ]
    },
    {
      id: 'data2',
      values: [
        { x: 'Monday', type: 'Beverages', y: 132 },
        { x: 'Tuesday', type: 'Beverages', y: 143 },
        { x: 'Wednesday', type: 'Beverages', y: 143 },
        { x: 'Thursday', type: 'Beverages', y: 132 },
        { x: 'Friday', type: 'Beverages', y: 130 },
        { x: 'Saturday', type: 'Beverages', y: 130 },
        { x: 'Sunday', type: 'Beverages', y: 150 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line0',
      dataId: 'data1',
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    },
    {
      type: 'line',
      id: 'line1',
      dataId: 'data2',
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesId: ['line0', 'bar'] },
    { orient: 'right', seriesId: 'line1' },
    ,
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Axis configuration](<https://www.visactor.io/vchart/option/barChart-axes-linear#seriesId(string%7Cnumber%7C(string%20%7C%20number)%5B%5D)>)
