---
category: examples
group: marker
title: markArea Axis Space and Data Point Positioning
keywords: marker, areaChart
order: 33-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/marker/mark-area-multi.png
option: lineChart#markArea
---

# markArea Axis Space and Data Point Positioning

markArea supports axis space positioning, data point, and arbitrary coordinate positioning. This showcases the effects of axis space and data point positioning.

## Key option

x-axis positioning:

- The `x` attribute declares the data or data aggregation value corresponding to the left boundary of the markArea. Aggregation methods supported are `"variance" | "average" | "min" | "max" | "sum" | "standardDeviation" | "median"`
- The `x1` attribute declares the data or data aggregation value corresponding to the left boundary of the markArea. Aggregation methods are the same as above

y-axis positioning:

- The `y` attribute declares the data or data aggregation value corresponding to the left boundary of the markArea. Aggregation methods are the same as above
- The `y1` attribute declares the data or data aggregation value corresponding to the left boundary of the markArea. Aggregation methods are the same as above

Data point positioning:

- The `coordinates` attribute declares an array of data points or data aggregation values for constructing the markArea outline. Aggregation methods are the same as above. The declaration method for data points is `{ xKey: value , yKey: value }`, where `xKey` is the data field corresponding to the x-axis; `yKey` is the data field corresponding to the y-axis; `value` is the value corresponding to the data field or data aggregation type, aggregation types are the same as above.

Label configuration:

- The `label` attribute declares the label properties for the corresponding annotation area
- The `label.text` attribute declares the text of the label
- The `label.position` attribute declares the position of the label relative to the annotation area; supported configurations are `"left" | "right" | "top" | "bottom" | "middle" | "insideLeft" | "insideRight" | "insideTop" | "insideBottom"`

## Live Demo

```javascript livedemo
const spec = {
  width: 800,
  type: 'line',
  xField: 'x',
  yField: 'y',
  markArea: [
    {
      x: 'min',
      x1: 4,
      label: {
        text: '区域: 从 minX 到 x = 4',
        position: 'insideTop'
      }
    },
    {
      y: 20,
      y1: 40,
      label: {
        text: '区域: 从 y = 20 到 y = 40',
        position: 'insideRight'
      }
    },
    {
      coordinates: [
        {
          x: 1,
          y: 10
        },
        {
          x: 2,
          y: 80
        },
        {
          x: 3,
          y: 80
        },
        {
          x: 4,
          y: 50
        }
      ],
      label: {
        text: '区域: 任意数据点连接',
        position: 'middle'
      }
    }
  ],
  data: {
    id: 'data2',
    values: [
      { x: 1, y: 80 },
      { x: 2, y: 40 },
      { x: 3, y: 10 },
      { x: 4, y: 20 }
    ]
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[scrollBar](link)
