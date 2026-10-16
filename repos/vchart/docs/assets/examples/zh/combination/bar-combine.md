---
category: examples
group: combination
title: 组合图自定义多行多列布局
keywords: commonChart
order: 22-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/combination/bar-combine.png
option: commonChart
---

# 组合图自定义多行多列布局

组合图通常需要通过自定义布局的方式进行不同系列的排列.

## 关键配置

- `type: 'common'` 声明为组合图类型
- `layout` 属性声明组合图自定义布局

  - `layout.type`属性声明布局类型, `grid`为行列布局
  - `layout.col`属性声明列数（注意: 所有图表中的独立元素都需要独占一列, 比如数据轴或其他组件 和 图表系列需要各占一列）
  - `layout.row`属性声明行数（注意: 同上）
  - `layout.col`属性指定列宽, 支持以`{ index: xx, size: xx }`的方式指定, `index`表示列所在的索引, `size`指列宽
  - `layout.row`属性指定行高, 支持以`{ index: xx, size: xx }`的方式指定, `index`表示行所在的索引, `size`指行高
  - `layout.elements`属性声明布局单元的 ID 以便数据系列与布局 d 单位绑定. 以`{modelId: xx, row: xx, col: xx}`的方式声明, 其中`modelId`表示布局单元的 ID 名, `row`和`col`分别表示布局单元所在行和列的索引.

- `region`属性声明数据区域以便后续绑定, 使用相同数据的布局单元需要绑定相同的`regionId`, 如坐标轴和其对应的图表系列所在的布局单元. 声明方式为`id: xx`, 其中`id`表示数据区域 ID.

- `series`属性声明不同的图表系列, 在系列配置中`regionIndex`用于绑定图表系列所在的数据区域. `id`用于绑定轴所在的布局单元, 与`layout.elements`中的`modelId`一一对应. （由于数据区域与`layout.elements`中的`modelId`存在对应关系, 所以此处不需要声明`id`）

- `axes`属性声明不同的坐标轴组件, `regionIndex`和`id`属性同上.

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  region: [
    {
      id: 'top'
    },
    {
      id: 'bottom'
    },
    {
      id: 'right'
    }
  ],
  layout: {
    type: 'grid',
    col: 4,
    row: 4,
    // 空行 或 空列 模拟padding
    colWidth: [
      {
        index: 2,
        size: 20
      }
    ],
    rowHeight: [
      {
        index: 1,
        size: 20
      }
    ],
    elements: [
      {
        modelId: 'top',
        col: 1,
        row: 0
      },
      {
        modelId: 'bottom',
        col: 1,
        row: 2
      },
      {
        modelId: 'right',
        col: 3,
        row: 2
      },
      {
        modelId: 'axesCol0',
        col: 0,
        row: 0
      },
      {
        modelId: 'axesCol1',
        col: 0,
        row: 2
      },
      {
        modelId: 'axesRow0',
        col: 1,
        row: 3
      },
      {
        modelId: 'axesRow1',
        col: 3,
        row: 3
      }
    ]
  },
  series: [
    {
      type: 'bar',
      dataId: 'dataHistogram',
      regionIndex: 0,
      xField: 'x',
      x2Field: 'x2',
      yField: 'y',
      bar: {
        style: {
          stroke: 'white',
          lineWidth: 1
        },
        state: {
          state1: {
            fill: 'black'
          }
        }
      },
      tooltip: {
        visible: true,
        mark: {
          title: {
            key: 'title',
            value: datum => datum['x'] + '-' + datum['x2']
          },
          content: [
            {
              key: datum => datum['x'] + '-' + datum['x2'],
              value: datum => datum['y']
            }
          ]
        }
      }
    },
    {
      type: 'scatter',
      dataId: 'dataScatter',
      regionIndex: 1,
      xField: 'x',
      yField: 'y',
      seriesField: 'color'
    },
    {
      type: 'bar',
      dataId: 'dataHistogram2',
      regionIndex: 2,
      xField: 'x',
      yField: 'y',
      y2Field: 'y2',
      direction: 'horizontal',
      bar: {
        style: {
          stroke: 'white',
          lineWidth: 1
        }
      },
      tooltip: {
        visible: true,
        mark: {
          title: {
            key: 'title',
            value: datum => datum['y'] + '-' + datum['y2']
          },
          content: [
            {
              key: datum => datum['y'] + '-' + datum['y2'],
              value: datum => datum['x']
            }
          ]
        }
      }
    }
  ],
  axes: [
    {
      orient: 'left',
      regionIndex: 0,
      id: 'axesCol0',
      type: 'linear',
      tick: {
        tickStep: 5
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'left',
      regionIndex: [1, 2],
      id: 'axesCol1',
      type: 'linear',
      tick: {
        tickStep: 50
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'bottom',
      label: { visible: true },
      regionIndex: [0, 1],
      id: 'axesRow0',
      type: 'linear',
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'bottom',
      label: { visible: true },
      regionIndex: 2,
      id: 'axesRow1',
      type: 'linear',
      tick: {
        tickStep: 50
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  data: [
    {
      id: 'dataHistogram',
      values: [
        {
          x: '0',
          x2: '1',
          y: '24'
        },
        {
          x: '1',
          x2: '2',
          y: '15'
        },
        {
          x: '2',
          x2: '3',
          y: '24'
        },
        {
          x: '3',
          x2: '4',
          y: '12'
        },
        {
          x: '4',
          x2: '5',
          y: '14'
        },
        {
          x: '5',
          x2: '6',
          y: '19'
        },
        {
          x: '6',
          x2: '7',
          y: '39'
        },
        {
          x: '7',
          x2: '8',
          y: '17'
        },
        {
          x: '8',
          x2: '9',
          y: '29'
        },
        {
          x: '9',
          x2: '10',
          y: '19'
        }
      ]
    },
    {
      id: 'dataHistogram2',
      values: [
        {
          y: '0',
          y2: '50',
          x: '222'
        },
        {
          y: '50',
          y2: '100',
          x: '291'
        },
        {
          y: '100',
          y2: '150',
          x: '129'
        },
        {
          y: '150',
          y2: '200',
          x: '114'
        },
        {
          y: '200',
          y2: '250',
          x: '36'
        },
        {
          y: '250',
          y2: '300',
          x: '56'
        },
        {
          y: '300',
          y2: '350',
          x: '77'
        },
        {
          y: '350',
          y2: '400',
          x: '224'
        },
        {
          y: '400',
          y2: '450',
          x: '26'
        },
        {
          y: '450',
          y2: '500',
          x: '175'
        }
      ]
    },
    {
      id: 'dataScatter',
      values: [
        {
          x: '1',
          y: '98',
          color: 'C'
        },
        {
          x: '7',
          y: '390',
          color: 'D'
        },
        {
          x: '0',
          y: '170',
          color: 'C'
        },
        {
          x: '9',
          y: '248',
          color: 'D'
        },
        {
          x: '8',
          y: '4',
          color: 'C'
        },
        {
          x: '8',
          y: '192',
          color: 'D'
        },
        {
          x: '6',
          y: '356',
          color: 'C'
        },
        {
          x: '4',
          y: '32',
          color: 'D'
        },
        {
          x: '9',
          y: '196',
          color: 'C'
        },
        {
          x: '2',
          y: '103',
          color: 'D'
        },
        {
          x: '7',
          y: '105',
          color: 'C'
        },
        {
          x: '5',
          y: '194',
          color: 'D'
        },
        {
          x: '7',
          y: '193',
          color: 'C'
        },
        {
          x: '6',
          y: '315',
          color: 'D'
        },
        {
          x: '7',
          y: '315',
          color: 'C'
        },
        {
          x: '2',
          y: '284',
          color: 'D'
        }
      ]
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
