---
category: examples
group: pivot chart
title: 透视组合图
keywords: pivotChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/preview/pivot-chart-radar.png
link: '../guide/table_type/pivot_chart'
option: PivotChart-indicators-chart#cellType
---

# 透视组合图

教程：https://visactor.io/vtable/guide/table_type/pivot_chart。

透视组合图将 vchart 图表库结合渲染到表格中，丰富可视化展示形式，提升渲染性能。

## 关键配置

- `PivotChart` 初始化表格类型使用 PivotChart。
- `VTable.register.chartModule('vchart', VChart)` 注册绘制图表的图表库 目前支持 VChart
- `cellType: 'chart'` 指定类型 chart
- `chartModule: 'vchart'` 指定注册的图表库名称
- `chartSpec: {}` 图表 spec

## 代码演示

```javascript livedemo template=vtable
VTable.register.chartModule('vchart', VChart);
let tableInstance;
fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/North_American_Superstore_Pivot_Chart_data.json')
  .then(res => res.json())
  .then(data => {
    const columns = [
      {
        dimensionKey: 'Region',
        title: 'Region',
        headerStyle: {
          textStick: true
        }
      }
    ];
    const rows = [
      {
        dimensionKey: 'Order Year',
        title: 'Order Year',
        headerStyle: {
          textStick: true
        }
      },
      'Ship Mode'
    ];
    const indicators = [
      {
        indicatorKey: 'Quantity',
        title: 'Quantity',
        cellType: 'chart',
        chartModule: 'vchart',
        chartSpec: {
          type: 'radar',
          categoryField: 'Segment',
          seriesField: 'Category',
          valueField: 'Quantity',
          data: {
            id: 'baseData'
          },
          scales: [
            {
              id: 'color',
              type: 'ordinal',
              domain: ['Furniture', 'Office Supplies', 'Technology'],
              range: ['#2E62F1', '#4DC36A', '#FF8406']
            }
          ]
        },
        style: {
          padding: 1
        }
      },
      {
        indicatorKey: 'Profit',
        title: 'Profit',
        cellType: 'chart',
        chartModule: 'vchart',
        chartSpec: {
          type: 'radar',
          categoryField: 'Segment',
          seriesField: 'Category',
          valueField: 'Profit',
          data: {
            id: 'baseData'
          },
          scales: [
            {
              id: 'color',
              type: 'ordinal',
              domain: ['Furniture', 'Office Supplies', 'Technology'],
              range: ['#2E62F1', '#4DC36A', '#FF8406']
            }
          ]
        },
        style: {
          padding: 1
        }
      }
    ];
    const option = {
      hideIndicatorName: false,
      rows,
      columns,
      indicators,
      records: data,
      defaultRowHeight: 200,
      defaultHeaderRowHeight: 50,
      defaultColWidth: 280,
      defaultHeaderColWidth: 100,
      indicatorTitle: '指标',
      autoWrapText: true,
      corner: {
        titleOnDimension: 'row',
        headerStyle: {
          autoWrapText: true
        }
      },
      legends: {
        orient: 'bottom',
        type: 'discrete',
        data: [
          {
            label: 'Furniture',
            shape: {
              fill: '#2E62F1',
              symbolType: 'circle'
            }
          },
          {
            label: 'Office Supplies',
            shape: {
              fill: '#4DC36A',
              symbolType: 'square'
            }
          },
          {
            label: 'Technology',
            shape: {
              fill: '#FF8406',
              symbolType: 'square'
            }
          }
        ]
      },
      pagination: {
        currentPage: 0,
        perPageCount: 8
      }
    };
    tableInstance = new VTable.PivotChart(document.getElementById(CONTAINER_ID), option);
    const { LEGEND_ITEM_CLICK } = VTable.ListTable.EVENT_TYPE;
    tableInstance.on(LEGEND_ITEM_CLICK, args => {
      console.log('LEGEND_ITEM_CLICK', args);
      tableInstance.updateFilterRules([
        {
          filterKey: 'Category',
          filteredValues: args.value
        }
      ]);
    });
    window.tableInstance = tableInstance;
  });
```
