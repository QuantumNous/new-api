---
category: demo
group: brush
title: Horizontal Selection Box
keywords: brush
order: 32-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/brush/x-linked-brush.png
option: commonChart#brush
---

# Horizontal Selection Box

The selection box component allows users to arbitrarily select chart elements within the chart area in a multi-selection format.

## Key Configuration

- The `brushType` property is declared as the selection box type, with optional values:

  - `'x'`: Horizontal selection
  - `'y'`: Vertical selection
  - `'rect'`: Rectangular selection box
  - `'polygon'`: Arbitrary shape selection box

- The `brushLinkSeriesIndex` property is declared as the series index of the linked selection box, and the series being linked will be highlighted along with the main series when configured.

- The `inBrush` property declares the style of the selected chart elements. In addition to the basic style properties of the elements, it also provides the following attributes:
  - `symbol`: The category of the element's shape (only valid when the type of the selected element is `'symbol'`).
  - `symbolSize`: The size of the element (only valid when the type of the selected element is `'symbol'`).
  - `color`: The color of the element.
  - `colorAlpha`: The transparency of the element, range `[0, 1]`.
- The `outOfBrush` property declares the style of the chart elements that are not selected. Configurable styles are the same as above.

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  stackField: 'stack',
  seriesField: 'type',
  layout: {
    type: 'grid',
    col: 3,
    row: 5,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        row: 4,
        colSpan: 3
      },
      {
        modelId: 'top',
        col: 1,
        row: 0
      },
      {
        modelId: 'middle',
        col: 1,
        row: 1
      },
      {
        modelId: 'bottom',
        col: 1,
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
        row: 1
      },
      {
        modelId: 'axesCol2',
        col: 2,
        row: 2
      },
      {
        modelId: 'axesRow',
        col: 1,
        row: 3
      }
    ]
  },
  region: [
    {
      id: 'top'
    },
    {
      id: 'middle'
    },
    {
      id: 'bottom'
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom',
    id: 'legend',
    regionIndex: [0, 1, 2]
  },
  series: [
    {
      type: 'bar',
      dataId: 'dataBar',
      regionIndex: 0,
      xField: ['x', 'type'],
      yField: 'y',
      seriesField: 'color'
    },
    {
      type: 'line',
      dataId: 'dataLine',
      regionIndex: 1,
      xField: 'x',
      yField: 'y',
      seriesField: 'color'
    },
    {
      type: 'bar',
      dataId: 'dataBar2',
      regionIndex: 2,
      xField: ['x', 'type'],
      yField: 'y',
      seriesField: 'color'
    }
  ],
  axes: [
    {
      orient: 'left',
      regionIndex: 0,
      id: 'axesCol0'
    },
    {
      orient: 'left',
      regionIndex: 1,
      id: 'axesCol1'
    },
    {
      orient: 'right',
      regionIndex: 2,
      id: 'axesCol2'
    },
    {
      orient: 'bottom',
      label: { visible: true },
      regionIndex: [0, 1, 2],
      id: 'axesRow'
    }
  ],
  brush: {
    brushType: 'x',
    regionId: 'top',
    brushLinkSeriesIndex: [1, 2],
    inBrush: {
      colorAlpha: 1
    },
    outOfBrush: {
      colorAlpha: 0.2
    }
  },
  data: [
    {
      id: 'dataBar',
      values: [
        {
          x: '0',
          y: '231',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '0',
          y: '285',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '1',
          y: '231',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '1',
          y: '155',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '2',
          y: '143',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '2',
          y: '204',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '3',
          y: '214',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '3',
          y: '47',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '4',
          y: '177',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '4',
          y: '140',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '5',
          y: '216',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '5',
          y: '248',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '6',
          y: '81',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '6',
          y: '220',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '7',
          y: '70',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '7',
          y: '39',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '8',
          y: '152',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '8',
          y: '172',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '9',
          y: '274',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '9',
          y: '248',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        }
      ]
    },
    {
      id: 'dataLine',
      values: [
        {
          x: '0',
          y: '89',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '0',
          y: '258',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '1',
          y: '173',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '1',
          y: '191',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '2',
          y: '143',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '2',
          y: '12',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '3',
          y: '202',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '3',
          y: '273',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '4',
          y: '77',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '4',
          y: '31',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '5',
          y: '53',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '5',
          y: '178',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '6',
          y: '222',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '6',
          y: '148',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '7',
          y: '150',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '7',
          y: '296',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '8',
          y: '224',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '8',
          y: '115',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '9',
          y: '104',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '9',
          y: '215',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '10',
          y: '240',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '10',
          y: '32',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '11',
          y: '165',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '11',
          y: '294',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '12',
          y: '128',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '12',
          y: '255',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '13',
          y: '155',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '13',
          y: '13',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '14',
          y: '36',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '14',
          y: '139',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '15',
          y: '275',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '15',
          y: '182',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '16',
          y: '247',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '16',
          y: '81',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '17',
          y: '26',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '17',
          y: '62',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '18',
          y: '268',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '18',
          y: '77',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        },
        {
          x: '19',
          y: '2',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'C'
        },
        {
          x: '19',
          y: '111',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'D'
        }
      ]
    },
    {
      id: 'dataBar2',
      values: [
        {
          x: '5',
          y: '141',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '5',
          y: '30',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '6',
          y: '8',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '6',
          y: '276',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '7',
          y: '125',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '7',
          y: '196',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '8',
          y: '174',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '8',
          y: '71',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '9',
          y: '251',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '9',
          y: '240',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '10',
          y: '295',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '10',
          y: '231',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '11',
          y: '112',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '11',
          y: '176',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '12',
          y: '278',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '12',
          y: '17',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '13',
          y: '270',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '13',
          y: '174',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        },
        {
          x: '14',
          y: '251',
          y2: '0',
          stack: 'a',
          type: 'A',
          color: 'A'
        },
        {
          x: '14',
          y: '130',
          y2: '0',
          stack: 'a',
          type: 'B',
          color: 'B'
        }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation related to this demo configuration.
