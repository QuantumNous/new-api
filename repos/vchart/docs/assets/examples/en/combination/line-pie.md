---
category: demo
group: combination
title: Line-Pie Combination Chart
keywords: commonChart
order: 22-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/combination/line-pie.png
option: commonChart
---

# Line-Pie Combination Chart

## Key option

- `type: 'common'` declares the chart as a combination chart type
- `layout` property declares the custom layout for the combination chart
  - `layout.type` property declares the layout type, `grid` for grid layout
  - `layout.col` property declares the number of columns (note: all independent elements in the charts need to occupy a separate column, such as data axis or other components and chart series need to occupy individual columns)
  - `layout.row` property declares the number of rows (note: same as above)
  - `layout.col` property specifies column width, supports specifying with `{ index: xx, size: xx }`, where `index` represents the index of the column, `size` indicates the column width
  - `layout.row` property specifies row height, supports specifying with `{ index: xx, size: xx }`, where `index` represents the index of the row, `size` indicates the row height
  - `layout.elements` property declares the layout unit ID for binding data series and layout unit. Declare it in `{modelId: xx, row: xx, col: xx}` format, where `modelId` represents the ID name of the layout unit, `row` and `col` represent the index of the row and column where the layout unit is located, respectively.

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  padding: {
    top: 10
  },
  layout: {
    type: 'grid',
    col: 2,
    row: 4,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        colSpan: 2,
        row: 0
      },
      {
        modelId: 'pie-region',
        col: 0,
        colSpan: 2,
        row: 1
      },
      {
        modelId: 'axis-left',
        col: 0,
        row: 2
      },
      {
        modelId: 'line-region',
        col: 1,
        row: 2
      },
      {
        modelId: 'axis-bottom',
        col: 1,
        row: 3
      }
    ]
  },
  region: [
    {
      id: 'pie-region',
      height: '40%'
    },
    {
      id: 'line-region'
    }
  ],
  legends: {
    visible: true,
    orient: 'top',
    id: 'legend',
    regionId: ['pie-region', 'line-region']
  },
  series: [
    {
      regionId: 'pie-region',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'pie',
        values: [
          { type: 'a', value: 10 },
          { type: 'b', value: 20 }
        ]
      },
      seriesField: 'type'
    },
    {
      regionId: 'line-region',
      type: 'line',
      xField: 'x',
      yField: 'y',
      data: {
        id: 'line',
        values: [
          { x: '1', y: 10, type: 'a' },
          { x: '1', y: 20, type: 'b' },
          { x: '2', y: 30, type: 'a' },
          { x: '2', y: 40, type: 'b' }
        ]
      },
      seriesField: 'type'
    }
  ],
  axes: [
    {
      id: 'axis-left',
      regionId: 'line-region',
      orient: 'left'
    },

    {
      id: 'axis-bottom',
      regionId: 'line-region',
      orient: 'bottom'
    }
  ],
  tooltip: {
    dimension: {
      visible: true
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
vchart.on('dimensionHover', {}, params => {
  console.log(params);
});
// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

TODO
