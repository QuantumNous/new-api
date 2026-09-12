---
category: examples
group: area chart
title: Range Area Chart
keywords: areaChart,comparison,trend,area,rangeAreaChart
order: 1-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/range-area.png
option: areaChart
---

# Range Area Chart

The range area chart is a variant of the area chart, which can be used to draw data ranges, with each point in the chart specified by two numeric attributes.
It is often combined with line charts to create composite charts.
In this example, the range area is created by the minimum and maximum values of different categories.

## Key option

- The `yField` attribute is configured as an array composed of the minimum and maximum numeric attributes

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'areaData',
      values: [
        { type: 'Category One', min: 76, max: 100 },
        { type: 'Category Two', min: 56, max: 108 },
        { type: 'Category Three', min: 38, max: 129 },
        { type: 'Category Four', min: 58, max: 155 },
        { type: 'Category Five', min: 45, max: 120 },
        { type: 'Category Six', min: 23, max: 99 },
        { type: 'Category Seven', min: 18, max: 56 },
        { type: 'Category Eight', min: 18, max: 34 }
      ]
    },
    {
      id: 'lineData',
      values: [
        { type: 'Category One', average: 88 },
        { type: 'Category Two', average: 82 },
        { type: 'Category Three', average: 83.5 },
        { type: 'Category Four', average: 106.5 },
        { type: 'Category Five', average: 82.5 },
        { type: 'Category Six', average: 61 },
        { type: 'Category Seven', average: 37 },
        { type: 'Category Eight', average: 26 }
      ]
    }
  ],
  series: [
    {
      type: 'rangeArea',
      dataIndex: 0,
      xField: 'type',
      yField: ['min', 'max'],
      stack: false,
      area: {
        style: {
          fillOpacity: 0.15
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      xField: 'type',
      yField: 'average',
      point: {
        state: {
          hover: {
            fillOpacity: 0.5,
            stroke: 'blue',
            lineWidth: 2
          },
          selected: {
            fill: 'red'
          }
        }
      }
    }
  ],

  axes: [
    {
      orient: 'left',
      label: {
        visible: true
      },
      type: 'linear'
    },
    { orient: 'bottom', type: 'band' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorial

[Area Chart](link)

```

```
