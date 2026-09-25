---
category: examples
group: marker
title: markLine Data Highlighting
keywords: lineChart,marker
order: 33-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/marker/mark-line-coordinates.png
option: lineChart#markLine
---

# markLine Data Highlighting

markLine highlights line chart data by data point positioning

## Key option

Data point positioning:

- The `coordinates` attribute declares the data points or aggregated data value array for constructing the markLine line. The declaration of data points is `{xKey: value, yKey: value}`, where `xKey` is the data field corresponding to the x-axis; `yKey` is the data field corresponding to the y-axis; `value` is the numerical value corresponding to the data field or data aggregation type, aggregation methods supported include `"variance" | "average" | "min" | "max" | "sum" | "standardDeviation" | "median"`.

Label configuration:

- The `label` attribute declares the label property corresponding to the annotation line
- The `label.text` attribute declares the text of the label
- The `label.refY` attribute declares the vertical offset of the label relative to line; similarly, the `label.refX` attribute declares the horizontal offset of the label relative to line
- The `label.position` attribute declares the position of the label relative to the annotation line; supports `"start" | "middle" | "end" | "insideStartTop" | "insideStartBottom" | "insideMiddleTop" | "insideMiddleBottom" | "insideEndTop" | "insideEndBottom"` configurations

## Live Demo

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    id: 'data2',
    values: [
      { x: 1, y: 80 },
      { x: 2, y: 40 },
      { x: 3, y: 10 },
      { x: 4, y: 20 }
    ]
  },
  xField: 'x',
  yField: 'y',
  markLine: [
    {
      coordinates: [
        { x: 1, y: 80 },
        { x: 2, y: 40 },
        { x: 3, y: 10 }
      ],
      label: {
        text: 'Some data is highlighted',
        autoRotate: true,
        position: 'insideMiddleTop',
        labelBackground: {
          padding: 2,
          style: {
            fill: '#E8346D'
          }
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      },
      line: {
        style: {
          stroke: '#E8346D',
          lineDash: [],
          lineWidth: 2
        }
      }
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Related Tutorials

[scrollBar](link)
