---
category: demo
group: combination
title: Bar-Line Combination Chart With UnNormal Axis
keywords: commonChart
order: 22-8
cover: /vchart/preview/combination-bar-line_1.10.3.png
option: commonChart
---

# Basic Combination Chart

## Key Configuration

- `type: 'common'` declares the chart type as a combination chart
- Configure the series you want to display in the `series` attribute
- Declare custom layout for the combination chart using the `layout` attribute
  - The `layout.type` attribute declares the layout type, `grid` for row-column layout
  - The `layout.col` attribute declares the number of columns (Note: Each independent element in all charts needs to occupy a column exclusively, such as data axes or other components, and chart series need to occupy a column each)
  - The `layout.row` attribute declares the number of rows (Note: Same as above)
  - The `layout.col` attribute specifies the column width, supporting specification in `{ index: xx, size: xx }` format, where `index` indicates the index of the column and `size` refers to the column width
  - The `layout.row` attribute specifies the row height, supporting specification in `{ index: xx, size: xx }` format, where `index` indicates the index of the row and `size` refers to the row height
  - The `layout.elements` attribute declares the ID of the layout unit so that the data series can be bound with the layout unit. Declare using the `{ modelId: xx, row: xx, col: xx }` format, where `modelId` indicates the ID name of the layout unit, and `row` and `col` represent the index of the row and column where the layout unit is located, respectively.

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Mon-Tue', type: 'a', y: 19 },
        { x: 'Tue-Web', type: 'a', y: 18 },
        { x: 'Wed-Thur', type: 'a', y: 16 },
        { x: 'Thur-Fri', type: 'a', y: 14 },
        { x: 'Fri-Sat', type: 'a', y: 12 },
        { x: 'Sat-Sun', type: 'a', y: 11 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Mon-Tue', type: 'b', y: 16 },
        { x: 'Tue-Web', type: 'b', y: 17 },
        { x: 'Wed-Thur', type: 'b', y: 18 },
        { x: 'Thur-Fri', type: 'b', y: 20 },
        { x: 'Fri-Sat', type: 'b', y: 24 },
        { x: 'Sat-Sun', type: 'b', y: 26 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      dataIndex: 0,
      xField: 'x',
      yField: 'y'
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left' },
    {
      orient: 'bottom',
      visible: true,
      domain: ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun'],
      label: { visible: true },
      type: 'band',
      // bandPadding: 0,
      // paddingInner: 1,
      // paddingOuter: 0
      trimPadding: true
    },
    {
      orient: 'bottom',
      visible: false,
      label: { visible: true },
      type: 'band',
      bandPadding: 0,
      paddingInner: 0,
      paddingOuter: 0
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

TODO
