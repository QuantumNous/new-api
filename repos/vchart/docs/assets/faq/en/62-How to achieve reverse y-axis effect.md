# How to achieve the reverse y-axis effect?

## Problem Description

Does VChart provide a configuration similar to echarts’ yaxis.inverse?

## solution

VChart provides the configuration of axis inversion, corresponding to the `inverse` attribute. You only need to configure it on the axis in the corresponding direction, as follows:

![](/vchart/faq/93-0.png)

## Code Example

```javascript livedemo
const spec = {
  type: 'area',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Monday', y: 12 },
        { x: 'Tuesday', y: 13 },
        { x: 'Wednesday', y: 11 },
        { x: 'Thursday', y: 10 },
        { x: 'Friday', y: 12 },
        { x: 'Saturday', y: 14 },
        { x: 'Sunday', y: 17 }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  axes: [
    {
      zIndex: 100,
      orient: 'bottom'
    },
    {
      zIndex: 101,
      orient: 'left',
      inverse: true, // inverse the left axis
      domainLine: {
        visible: true,
        // show the endSymbol
        endSymbol: {
          visible: true,
          style: {
            fill: '#000'
          }
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related documents

- [Coordinate Axis Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes)
- [Coordinate axis configuration](https://www.visactor.io/vchart/option/lineChart#axes-linear.inverse)
