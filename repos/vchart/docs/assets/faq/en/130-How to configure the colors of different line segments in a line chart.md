# How to configure the colors of different line segments in a line chart?

## Question Description

I am dealing with the requirement of a line chart, and I need to configure the line segments in the line chart to be different colors, but the chart examples and some library functions I have found can only make the line segments the same color. Is there any solution?

## Solution

In VChart, different line segments in the line chart can be set to different styles through the line.style configuration. At the same time, VChart also supports setting callback functions to return style results based on different data contents.

## Code Example

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        x: '1st',
        y: 0.012
      },
      {
        x: '2nd',
        y: -0.01
      },
      {
        x: '3rd',
        y: 0.005
      },
      {
        x: '4th',
        y: 0.007
      },
      {
        x: '5th',
        y: 0.01
      },
      {
        x: '6th',
        y: 0.017
      },
      {
        x: '7th',
        y: 0.022
      },
      {
        x: '8th (prediction)',
        y: 0.033,
        latest: true
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  line: {
    style: {
      stroke: datum => {
        if (datum.latest) {
          return 'red';
        }
        return 'blue';
      },
      lineDash: datum => {
        if (datum.latest) {
          return [5, 5];
        }
        return [0];
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Dashed line example](https://www.visactor.io/vchart/demo/line-chart/dash-line)
