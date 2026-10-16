---
category: examples
group: area chart
title: Streamgraph
keywords: areaChart,comparison,trend,area,streamgraph,composition
order: 1-9
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/stream-graph.png
---

# Streamgraph

Streamgraph is a type of stacked area chart. It displays a value (Y-axis) evolving with another value (X-axis). This evolution represents several groups, all of which have different colors.
In contrast to the stacked area, there are no corners: the edges are rounded, giving a smooth impression. Moreover, the areas usually move around a central axis, forming flowing organic shapes.
The following example shows the evolution of baby name frequencies in the United States between 1880 and 2015.

## Key option

- The `seriesField` property is used to declare the field involved in color mapping
- The `stack` property is set to true to configure stacking, and will stack according to the field declared by the `seriesField` property
- The `stackOffsetSilhouette` property is set to `true` to configure placing the series symmetrically around the centerline

## Demo source

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/stream-graph-data.json');
const data = await response.json();

const spec = {
  type: 'area',
  data: {
    id: 'data',
    values: data
  },
  color: ['#F7FCFD', '#E0ECF4', '#BFD3E6', '#9EBCDA', '#8C96C5', '#8C6BB1', '#88419D', '#810F7C', '#4D004A'],
  title: {
    visible: true,
    text: 'EVOLUTION OF BABY NAMES IN THE US'
  },

  xField: 'year',
  yField: 'n',
  seriesField: 'name',
  stackOffsetSilhouette: true,
  point: { visible: false },
  area: {
    style: {
      fillOpacity: 0.4
    },
    state: {
      hover: {
        style: {
          fillOpacity: 1
        }
      }
    }
  },
  legends: [{ range: [], visible: true, position: 'middle', orient: 'bottom' }],

  axes: [
    {
      orient: 'left',
      visible: false
    },
    {
      orient: 'bottom',
      label: { visible: true }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Related Tutorials

[Area Chart](link)
