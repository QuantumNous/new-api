# How to customize the axis scale value of a gauge chart?

## Question Description

How does VChart configure the scale value of the gauge chart? As shown in the figure below, I only want 0, 25, 50, 75, 100.

![description](/vchart/faq/68-0.png)

## Solution

You can refer to the following demo to change the spec of the angle axis of the gauge chart, and solve the problem by configuring the maximum / minimum value and step size of the axis tick.

## Code Example

```javascript livedemo
const spec = {
  type: 'gauge',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Target A',
          value: 60
        }
      ]
    }
  ],
  categoryField: 'type',
  valueField: 'value',
  outerRadius: 0.8,
  innerRadius: 0.6,
  startAngle: -240,
  endAngle: 60,
  axes: [
    {
      type: 'linear',
      orient: 'angle',
      max: 100,
      min: 0,
      tick: {
        visible: true,
        tickStep: 25
      },
      subTick: {
        visible: true
      },
      inside: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Result

![demo](/vchart/faq/68-1.png)

## Quote

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

Demo page: [https://www.visactor.io/vchart/demo/gauge-chart/basic-gauge](https://www.visactor.io/vchart/demo/gauge-chart/basic-gauge)
