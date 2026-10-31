---
category: demo
group: combination
title: Dual Axis Chart
keywords: commonChart
order: 22-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/combination/dual-axis.png
option: commonChart
---

# Dual Axis Chart

## Key option

- `type: 'common'` declares the combined chart type
- `axes`'s `seriesIndex` property is configured as the `series` index to be associated with the axis
- `axes`'s `seriesId` property is configured as an array of the `id` of the `series` to be associated with the axis.
- `layout` property declares the combination chart custom layout
  - `layout.type` property declares the layout type, `grid` for row and column layout
  - `layout.col` property declares the number of columns (Note: All independent elements in the chart need to occupy a separate column, such as data axes or other components, and chart series need to occupy separate columns)
  - `layout.row` property declares the number of rows (Note: Same as above)
  - `layout.col` property specifies column width, supports specifying by `{ index: xx, size: xx }`, where `index` represents the index of the column and `size` indicates column width
  - `layout.row` property specifies row height, supports specifying by `{ index: xx, size: xx }`, where `index` represents the index of the row and `size` indicates row height
  - `layout.elements` property declares the layout unit's ID for data series and layout unit binding. Declared by `{modelId: xx, row: xx, col: xx}`, where `modelId` represents the ID name of the layout unit, and `row` and `col` respectively represent the indices of the rows and columns of the layout unit.

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: '周一', type: '早餐', y: 15 },
        { x: '周一', type: '午餐', y: 25 },
        { x: '周二', type: '早餐', y: 12 },
        { x: '周二', type: '午餐', y: 30 },
        { x: '周三', type: '早餐', y: 15 },
        { x: '周三', type: '午餐', y: 24 },
        { x: '周四', type: '早餐', y: 10 },
        { x: '周四', type: '午餐', y: 25 },
        { x: '周五', type: '早餐', y: 13 },
        { x: '周五', type: '午餐', y: 20 },
        { x: '周六', type: '早餐', y: 10 },
        { x: '周六', type: '午餐', y: 22 },
        { x: '周日', type: '早餐', y: 12 },
        { x: '周日', type: '午餐', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: '周一', type: '饮料', y: 22 },
        { x: '周二', type: '饮料', y: 43 },
        { x: '周三', type: '饮料', y: 33 },
        { x: '周四', type: '饮料', y: 22 },
        { x: '周五', type: '饮料', y: 10 },
        { x: '周六', type: '饮料', y: 30 },
        { x: '周日', type: '饮料', y: 50 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      label: { visible: true },
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0] },
    { orient: 'right', seriesId: ['line'], grid: { visible: false } },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

TODO
