# How do I set up some lines to follow the left axis, while the others follow the right axis in a line chart?

## Question Description

I have a line chart with multiple lines.
What chart tools can explicitly specify that the graph follows the left or right axis?
After careful consideration, I found a line chart often has a bottom axis.
Complex usage scenarios: Some of lines follow the left axis. The others follow the right axis. At the same time, all the lines follow the bottom axis.
In abstract terms, it means that each line can correspond to multiple lines.

## Solution

VChart charts have already provided the corresponding functionality. VChart supports the following:

- Binding dataId on series to maintain a one-to-one relationship between data and series.
- Binding seriesId on axis to maintain a one-to-many relationship between axis and series.

[LineChart Series Spec Documents](https://visactor.io/vchart/option/commonChart#series-line.type)

## Code Example

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'profit',
      values: [
        { time: '2019', value: 100000 },
        { time: '2020', value: 200000 },
        { time: '2021', value: 300000 },
        { time: '2022', value: 400000 },
        { time: '2023', value: 500000 }
      ]
    },
    {
      id: 'saleDiscount',
      values: [
        { time: '2019', value: 0.2 },
        { time: '2020', value: 0.35 },
        { time: '2021', value: 0.25 },
        { time: '2022', value: 0.2 },
        { time: '2023', value: 0.1 }
      ]
    }
  ],
  axes: [
    {
      orient: 'left',
      seriesId: ['profit'],
      id: 'left'
    },
    {
      sync: {
        axisId: 'left',
        tickAlign: true,
        zeroAlign: true
      },
      id: 'right',
      label: {
        formatMethod: v => parseFloat(v).toFixed(2)
      },
      orient: 'right',
      seriesId: ['saleDiscount']
    },
    {
      orient: 'bottom',
      seriesId: ['saleDiscount', 'profit']
    }
  ],
  series: [
    {
      id: 'profit',
      type: 'line',
      xField: 'time',
      yField: 'value',
      dataId: 'profit'
    },
    {
      id: 'saleDiscount',
      type: 'line',
      xField: 'time',
      yField: 'value',
      dataId: 'saleDiscount'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Axes Tutorial](http://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes)
- [Combination Chart Tutorial](http://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination)
- [Line Chart Spec Documents](https://visactor.io/vchart/option/commonChart#series-line.type)
- [Dual Axis Chart Demo](http://visactor.io/vchart/demo/combination/dual-axis)
