# When the data is all 0, how to configure the position of the x-axis?

## Question Description

Similar to (https://www.visactor.io/vchart/demo/line-chart/basic-line) such a line chart with all 0 data,
The position of the x-axis will center the polyline. I want to adjust the position of the X-axis so that the X-axis is aligned with the Y scale of 0. How to achieve this?

## Solution

Different chart libraries have different solutions. According to the demo you gave, you only need to set the axes-linear.zero of the Y axis to true.

- barChart-axes-linear.zero = true only works if the axis is a linear axis, whether to include 0 value. When min and max are configured, this configuration item becomes invalid.

## Code Example

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 0
      },
      {
        time: '4:00',
        value: 0
      },
      {
        time: '6:00',
        value: 0
      },
      {
        time: '8:00',
        value: 0
      },
      {
        time: '10:00',
        value: 0
      },
      {
        time: '12:00',
        value: 0
      },
      {
        time: '14:00',
        value: 0
      },
      {
        time: '16:00',
        value: 0
      },
      {
        time: '18:00',
        value: 0
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  axes: [
    {
      orient: 'left',
      zero: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Results

- [Online demo](https://codesandbox.io/s/data-is-all-0-smhq6h)

## Quote

- [Basic Line Chart Demo](https://www.visactor.io/vchart/demo/line-chart/basic-line)
- [Axes Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes)
- [Related API](https://www.visactor.io/vchart/option/lineChart-axes-linear#zero)
- [github](https://github.com/VisActor/VChart)
