---
category: demo
group: combination
title: Multi-region Pie Chart
keywords: commonChart
order: 22-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/combination/col-pie.png
option: commonChart
---

# Multi-region Pie Chart

## Key option

- `type: 'common'` declares the chart as a combination chart type
- The `layout` attribute declares the custom layout for the combination chart
  - The `layout.type` attribute declares the layout type; `grid` is the row and column layout
  - The `layout.col` attribute declares the number of columns (Note: all independent elements in the charts need to occupy a column, such as data axes or other components, and the chart series need to take up one column each)
  - The `layout.row` attribute declares the number of rows (Note: same as above)
  - The `layout.col` attribute specifies the column width, supporting the format `{ index: xx, size: xx }`, with `index` indicating the column index and `size` the column width
  - The `layout.row` attribute specifies the row height, supporting the format `{ index: xx, size: xx }`, with `index` indicating the row index and `size` the row height
  - The `layout.elements` attribute declares the ID of the layout unit for binding data series and layout units. Declared in the format `{modelId: xx, row: xx, col: xx}`, where `modelId` represents the ID name of the layout unit, and `row` and `col` indicate the row and column indexes of the layout unit, respectively.

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  padding: {
    top: 10
  },
  layout: {
    type: 'grid',
    col: 1,
    row: 5,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        row: 4
      },
      {
        modelId: 'DAU',
        col: 0,
        row: 0
      },
      {
        modelId: '新增',
        col: 0,
        row: 1
      },
      {
        modelId: 'MAU',
        col: 0,
        row: 2
      },
      {
        modelId: 'DAU/MAU',
        col: 0,
        row: 3
      }
    ]
  },
  region: [
    {
      id: 'DAU'
    },
    {
      id: '新增'
    },
    {
      id: 'MAU'
    },
    {
      id: 'DAU/MAU'
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom',
    id: 'legend',
    regionId: ['DAU', '新增', 'MAU', 'DAU/MAU'],
    item: {
      visible: true,
      background: {
        style: {
          fill: 'transparent'
        }
      }
    }
  },
  series: [
    {
      id: 'DAUseries0',
      regionId: 'DAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'DAU',
        values: [
          {
            type: '首页',
            value: 120
          },
          {
            type: '大屏',
            value: 100
          },
          {
            type: '看板',
            value: 200
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },
    {
      id: '新增series0',
      regionId: '新增',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: '新增',
        values: [
          {
            type: '首页',
            value: 80
          },
          {
            type: '大屏',
            value: 200
          },
          {
            type: '看板',
            value: 400
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },
    {
      id: 'MAUseries0',
      regionId: 'MAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'MAU',
        values: [
          {
            type: '首页',
            value: 123
          },
          {
            type: '大屏',
            value: 245
          },
          {
            type: '看板',
            value: 367
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },
    {
      id: 'DAU/MAUseries0',
      regionId: 'DAU/MAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'DAU/MAU',
        values: [
          {
            type: '首页',
            value: 10
          },
          {
            type: '大屏',
            value: 18
          },
          {
            type: '看板',
            value: 8
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

TODO
