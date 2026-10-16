# How to configure the range of the axis?

## Question Description

In my dual-axis chart, the right axis represents the percentage. Can this percentage range be manually configured? I am using vchart and have configured min and max, but it has not taken effect. My configuration:
![demo](/vchart/faq/18-0.png)

```js
{
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: '2021-10-22', type: 'A', y: 10 },
        { x: '2021-10-23', type: 'B', y: 22 },
      ]
    },
    {
      id: 'id1',
      values: [
        { x: '2021-10-22', type: 'TA', y: 0.5 },
        { x: '2021-10-22', type: 'TB', y: 1.1 },
        { x: '2021-10-23', type: 'TA', y: 1 },
        { x: '2021-10-23', type: 'TB', y: 1.5 },

      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      label: { visible: true ,position:'inside'},
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      max: 100
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      min: 0,
      max: 2,
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0] },
    { orient: 'right', seriesId: ['line'], grid: { visible: false }},
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
}
```

## Solution

The configuration of the axis range is in the `axes` configuration item, not in the `series`. You can configure the minimum value (`min`) and maximum value (`max`) as your need, for example:

```js
axes: [
  { orient: 'left', max: 100 },
  { orient: 'right', min:0, max:2 },
],
```

## Code Example

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: '2021-10-22', type: 'A', y: 10 },
        { x: '2021-10-23', type: 'B', y: 22 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: '2021-10-22', type: 'TA', y: 0.5 },
        { x: '2021-10-22', type: 'TB', y: 1.1 },
        { x: '2021-10-23', type: 'TA', y: 1 },
        { x: '2021-10-23', type: 'TB', y: 1.6 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      label: { visible: true, position: 'inside' },
      seriesField: 'type',
      xField: 'x',
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0], max: 100 },
    { orient: 'right', seriesId: ['line'], grid: { visible: false }, min: 0, max: 2 },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [More demos](https://visactor.io/vchart/demo/combination/dual-axis)
- [Axes tutorial](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes)
- [Related API](https://visactor.io/vchart/option/lineChart#axes-linear.min)
- [github](https://github.com/VisActor/VChart)
