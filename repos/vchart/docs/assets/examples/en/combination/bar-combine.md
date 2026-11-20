---
category: examples
group: combination
title: Custom Multi-Row Multi-Column Layout in Combination Charts
keywords: commonChart
order: 22-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/combination/bar-combine.png
option: commonChart
---

# Custom Multi-Row Multi-Column Layout in Combination Charts

Combination charts often need to arrange different series through custom layouts.

## Key option

- `type: 'common'` declares combination chart type
- `layout` attribute declares custom layouts for combination charts

  - `layout.type` attribute declares layout type, `grid` for row and column layout
  - `layout.col` attribute declares the number of columns (Note: each independent element in all charts needs to occupy a separate column, such as data axes or other components, and chart series also need to occupy a column each)
  - `layout.row` attribute declares the number of rows (Note: same as above)
  - `layout.col` attribute specifies column width, supporting the format `{ index: xx, size: xx }`, where `index` represents the index of the column and `size` represents the column width.
  - `layout.row` attribute specifies row height, supporting the format `{ index: xx, size: xx }`, where `index` represents the index of the row and `size` represents the row height.
  - `layout.elements` attribute declares the IDs of layout units for data series and layout unit binding. The format is `{modelId: xx, row: xx, col: xx}`, where `modelId` represents the ID name of the layout unit, and `row` and `col` represent the index of the row and column where the layout unit is located, respectively.

- `region` attribute declares data region for subsequent binding. Layout units using the same data need to bind the same `regionId`, such as axis and its corresponding chart series on the layout unit. The declaration format is `id: xx`, where `id` represents the data region ID.

- `series` attribute declares different chart series. In the series configuration, `regionIndex` is used to bind the data region where the chart series is located. `id` is used to bind the layout unit where the axis is located, corresponding one-to-one with the `modelId` in `layout.elements`. (Since there is a corresponding relationship between the data region and the `modelId` in `layout.elements`, there is no need to declare `id` here)

- `axes` attribute declares different axis components. `regionIndex` and `id` attributes are the same as above.

## Demo source

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Bar Chart](link)
