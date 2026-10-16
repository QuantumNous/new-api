# How to customize the axis label display spacing?

## Question Description

A line chart like (https://visactor.io/vchart/demo/line-chart/basic-line),
How to realize the display spacing of custom axis labels?

## Solution

The solution varies depending on the chart library being used. Based on the provided demo, you simply need to set the corresponding field to false in order to disable stacking.

- MinGap can be used to customize the minimum spacing between labels (unit: pixels). Only takes effect when axis sampling starts (sampling: true). This configuration affects the results of axis sampling.

## Code Example

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  axes: [
    {
      orient: 'bottom',
      label: {
        minGap: 80
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Results

- [Online demo](https://codesandbox.io/s/customize-axis-label-spacing-9ml6nv)

## Quote

- [Basic Line Chart Demo](https://www.visactor.io/vchart/demo/line-chart/basic-line)
- [Line Chart Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Line)
- [Related api](https://www.visactor.io/vchart/option/lineChart#axes-band.label.minGap)
- [github](https://github.com/VisActor/VChart)
