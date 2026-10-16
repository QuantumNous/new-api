# The time interval of the coordinate axis scale is given (one quarter), how can I set it to display only three coordinate axis scales? Or make it adaptively uniform?

## Question Description

The time interval of the coordinate axis scale is given (one quarter), how can I set it to display only three coordinate axis scales? Or make it adaptively uniform?

## Solution

In VChart, there are four types of coordinate axes: linear, band, time, and log. For each type of coordinate axis, you only need to set tick.tickCount=3 or tick.forceTickCount=3 to specify the number of axis ticks.In VChart, there are four types of coordinate axes: linear, band, time, and log. For each type of coordinate axis, you only need to set tick.tickCount=3 or tick.forceTickCount=3 to specify the number of axis ticks.

When tickCount is not specified, adaptive tick count will be used to automatically find the maximum tick count that can prevent overlapping of all axis labels.

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
      orient: 'left',
      domainLine: { visible: false },
      tick: { visible: false },
      label: {
        style: {
          fill: 'rgb(162, 162, 162)'
        }
      },
      grid: {
        style: {
          lineDash: [0],
          stroke: 'rgb(231, 231, 231)'
        }
      }
    },
    {
      orient: 'bottom',
      domainLine: { visible: true, style: { stroke: '#000' } },
      tick: {
        style: { stroke: '#000' },
        tickCount: 3
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

- [Online demo](https://codesandbox.io/s/line-chart-tick-count-fxh599?file=/src/index.ts)

## Quote

- [LineChart Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Line)
- [Related api](https://www.visactor.io/vchart/option/lineChart#axes-linear.tick.tickCount)
- [github](https://github.com/VisActor/VChart)
