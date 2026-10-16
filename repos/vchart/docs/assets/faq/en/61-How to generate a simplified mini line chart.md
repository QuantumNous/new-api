# How to generate a simplified mini line chart?

## Question Description

I would like to create an extremely simplified line chart that minimizes space usage while efficiently conveying the trends and variations in the data.
Therefore, I expect this line chart to exclude components such as axes, labels, and legends, focusing solely on the line segments.

## Solution

The various chart components in VChart provide rich style configurations.
By setting `visible:false` in the component configuration, you can hide the component and create a more simplified line chart.

## Code Example

```javascript livedemo
const spec = {
  type: 'line',
  // type: 'area',
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
  padding: 0,
  margin: 0,
  point: {
    visible: false
  },
  line: {
    style: {
      curveType: 'monotone'
    }
  },
  axes: [
    {
      type: 'linear',
      orient: 'left',
      nice: true,
      zero: true,
      visible: false
    },
    {
      type: 'band',
      paddingOuter: 0,
      paddingInner: 0,
      orient: 'bottom',
      visible: false
    }
  ],
  legends: [
    {
      visible: false
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
- [VChart Axes Guide](https://visactor.io/vchart/guide/concepts/axes)
- [VChart Line Chart Guide](https://visactor.io/vchart/guide/chart/line)
