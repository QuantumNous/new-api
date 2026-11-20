# How to configure the axis scale alignment of a two-axis graph?

## Question Description

When I use the VChart chart, may I ask whether the data around the two horizontal coordinates can be aligned? The effect is equivalent to two axes overlapping.

![tooltip](/vchart/faq/47-0.png)

## Solution

VChart provided in this configuration. If you need synchronized axis alignment to 0, it can be configured in the reference documentation: [https://visactor.io/vchart/option/barChart#axes-linear.sync.axisId](https://visactor.io/vchart/option/barChart#axes-linear.sync.axisId)

Use sync to specify the right axis and left axis alignment. Note that you need to define an id for the left axis so that you can specify it in the other axes.

## Code Example

```javascript
spec.axes = [
  {
    orient: 'left',
    id: 'left_axis',
    seriesIndex: [0]
  },
  {
    orient: 'right',
    seriesId: ['line'],
    grid: {
      visible: false
    },
    sync: {
      axisId: 'left_axis',
      zeroAlign: true
    }
  }
];
```

## Result

![demo](/vchart/faq/47-1.png)

Demo: [https://codesandbox.io/s/dual-axis-zero-align-9y49w3?file=/src/index.ts](https://codesandbox.io/s/dual-axis-zero-align-9y49w3?file=/src/index.ts)

## Quote

Axis option: [https://visactor.io/vchart/option/barChart#axes-linear.sync.axisId](https://visactor.io/vchart/option/barChart#axes-linear.sync.axisId)

github: [https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)
