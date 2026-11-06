---
category: examples
group: bar chart
title: Bar Chart with MarkPoint
keywords: barChart,comparison,distribution,rectangle,markPoint
cover: /vchart/preview/bar-markPoint_1.5.0.png
option: barChart
---

# Bar Chart with MarkPoint

In the bar chart, `markPoint` can be used to annotate data on the top of columns.

## Key option

- In the `axes` property, configure `grid.alignWithLabel` for the axis at the bottom position to be false, so that it is displayed in the middle between the two scales.

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  height: 300,
  data: [
    {
      id: 'barData',
      values: [
        { time: '10:20', cost: 2 },
        { time: '10:30', cost: 1 },
        { time: '10:40', cost: 1 },
        { time: '10:50', cost: 2 },
        { time: '11:00', cost: 2 },
        { time: '11:10', cost: 2 },
        { time: '11:20', cost: 1 },
        { time: '11:30', cost: 1 },
        { time: '11:40', cost: 2 },
        { time: '11:50', cost: 1 }
      ]
    }
  ],
  xField: 'time',
  yField: 'cost',
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'rect',
        style: {
          fill: 'rgb(85,208,93)',
          fillOpacity: 0.1
        }
      },
      bindingAxesIndex: [1],
      defaultSelect: {
        axisIndex: 1,
        datum: '10:20'
      }
    }
  },
  label: {
    visible: true,
    animation: false,
    formatMethod: datum => `${datum} mins`,
    style: {
      fill: 'rgb(155,155,155)'
    }
  },
  bar: {
    style: {
      fill: 'rgb(85,208,93)',
      cornerRadius: [4, 4, 0, 0],
      width: 30
    }
  },
  markPoint: [
    {
      coordinate: {
        time: '10:20',
        cost: 2
      },
      itemContent: {
        offsetY: -10,
        type: 'text',
        autoRotate: false,
        text: {
          text: '2 mins',
          labelBackground: {
            padding: [5, 10, 5, 10],
            style: {
              fill: '#000',
              cornerRadius: 5
            }
          }
        },
        style: {
          dy: 14,
          fill: 'white',
          fontSize: 14
        }
      },
      itemLine: {
        endSymbol: {
          visible: true,
          style: {
            angle: Math.PI,
            scaleY: 0.4,
            fill: '#000',
            dy: 4,
            stroke: '#000'
          }
        },
        startSymbol: { visible: false },
        line: {
          style: {
            visible: false
          }
        }
      }
    }
  ],
  animationUpdate: false,
  axes: [
    {
      orient: 'left',
      max: 10,
      label: { visible: false },
      grid: {
        style: { lineDash: [4, 4] }
      }
    },
    {
      orient: 'bottom',
      label: {
        formatMethod: datum => {
          return datum === '10:20' ? 'Current' : datum;
        },
        style: (datum, a, b) => {
          return {
            fontSize: datum === '10:20' ? 14 : 12,
            fill: datum === '10:20' ? 'black' : 'grey'
          };
        }
      },
      paddingOuter: 0.5,
      paddingInner: 0,
      grid: {
        visible: true,
        alignWithLabel: false,
        style: { lineDash: [4, 4] }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Column Chart](link)
