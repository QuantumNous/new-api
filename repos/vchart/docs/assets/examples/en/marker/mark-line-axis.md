---
category: examples
group: marker
title: markLine Axis Space Positioning
keywords: lineChart,marker
order: 33-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/marker/mark-line-axis.png
option: lineChart#markLine
---

# markLine Axis Space Positioning

## Key option

x-axis positioning:

- The `x` attribute declares the x data or data aggregation value of markLine for positioning the x-coordinate. Aggregation methods are supported including `"variance" | "average" | "min" | "max" | "sum" | "standardDeviation" | "median"`.

y-axis positioning:

- The `y` attribute declares the y data or data aggregation value of markLine for positioning the y-coordinate. The supported aggregation methods are the same as above.

Label configuration:

- The `label` attribute declares the label properties for the corresponding marked line.
- The `label.text` attribute declares the text of the label.
- The `label.refY` attribute declares the vertical offset of the label relative to the line; similarly, the `label.refX` attribute declares the horizontal offset of the label relative to the line.
- The `label.position` attribute declares the position of the label relative to the marked line and supports configurations like `"start" | "middle" | "end" | "insideStartTop" | "insideStartBottom" | "insideMiddleTop" | "insideMiddleBottom" | "insideEndTop" | "insideEndBottom"`.

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  markLine: [
    {
      x: 'Wed',
      label: {
        text: 'National holiday',
        position: 'insideEndBottom',
        refY: 10,
        labelBackground: {
          padding: 5,
          style: {
            stroke: '#6690F2',
            fillOpacity: 0
          }
        },
        style: {
          fill: '#6690F2'
        }
      },
      line: {
        style: {
          stroke: '#6690F2',
          lineDash: []
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      }
    },
    {
      y: 'average',
      label: {
        text: 'Average Visit Num',
        position: 'insideEndBottom',
        refY: -10,
        labelBackground: {
          padding: 2,
          style: {
            fill: '#6690F2'
          }
        },
        style: {
          fontSize: 12
        }
      },
      line: {
        style: {
          stroke: '#6690F2',
          lineDash: []
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      }
    }
  ],
  line: {
    style: {
      curveType: 'monotone'
    }
  },
  data: {
    id: 'data2',
    values: [
      { x: 'Mon', y: 14000, type: 'A' },
      { x: 'Tue', y: 14500, type: 'A' },
      { x: 'Wed', y: 24000, type: 'A' },
      { x: 'Thu', y: 13000, type: 'A' },
      { x: 'Fri', y: 15000, type: 'A' },
      { x: 'Sat', y: 19000, type: 'A' },
      { x: 'Sun', y: 21000, type: 'A' },
      { x: 'Mon', y: 15000, type: 'B' },
      { x: 'Tue', y: 14800, type: 'B' },
      { x: 'Wed', y: 25000, type: 'B' },
      { x: 'Thu', y: 9000, type: 'B' },
      { x: 'Fri', y: 15000, type: 'B' },
      { x: 'Sat', y: 20000, type: 'B' },
      { x: 'Sun', y: 19000, type: 'B' }
    ]
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related tutorial

[scrollBar](link)
