---
category: demo
group: combination
title: Basic Combination Chart
keywords: commonChart
order: 22-8
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/combination/single-region.png
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
      dataIndex: 0,
      label: { visible: true },
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Related Tutorials

TODO
