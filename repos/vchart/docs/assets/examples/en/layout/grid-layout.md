---
category: examples
group: layout
title: Row and Column Layout
order: 37-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/layout/grid-layout.png
option: commonChart#layout
---

# Row and Column Layout

In the diagram, in addition to the built-in layout logic, the user can also pass`layout.type: 'grid'`Declare row and column layout.

## Key option

- modelId The id of the layout module.
- What column is the col element in? Count from left to right, starting at 0.
- The row element is on the row. From top to bottom, counting from 0.
- colSpan column direction, the current element occupies several columns, the default value is 1.
- rowSpan row direction, the current element occupies several rows, the default value is 1.

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.7,
          text: '70%'
        }
      ]
    }
  ],
  layout: {
    type: 'grid',
    col: 2,
    row: 1,
    elements: [
      {
        modelId: 'circularProgress',
        col: 1,
        row: 0
      },
      {
        modelId: 'indicator',
        col: 0,
        row: 0
      }
    ]
  },
  region: [
    {
      id: 'circularProgress'
    },
    {
      id: 'indicator'
    }
  ],
  series: [
    {
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'pie',
        values: [
          { type: 'a', value: 30 },
          { type: 'b', value: 70 }
        ]
      },
      seriesField: 'type',
      outerRadius: 0.45,
      innerRadius: 0.4
    }
  ],
  indicator: [
    {
      regionId: 'circularProgress',
      visible: true,
      title: {
        visible: true,
        autoFit: true,
        style: {
          text: 'percent'
        }
      },
      content: {
        visible: true,
        autoFit: true,
        style: {
          text: '70%'
        }
      }
    },
    {
      regionId: 'indicator',
      visible: true,
      title: {
        style: {
          text: '267',
          dx: -150,
          dy: -100,
          fontSize: 80,
          fontWeight: 800,
          textAlign: 'left'
        }
      },
      content: {
        style: {
          text: 'total number of tags',
          dx: -150,
          dy: -100,
          fill: '#AAA',
          fontSize: 30,
          fontWeight: 600,
          textAlign: 'left'
        }
      }
    },
    {
      regionId: 'indicator',
      visible: true,
      title: {
        style: {
          text: '267',
          dx: -150,
          dy: 100,
          fontSize: 40,
          fontWeight: 800,
          textAlign: 'left'
        }
      },
      content: {
        style: {
          text: 'actual tag',
          dx: -150,
          dy: 100,
          fill: '#AAA',
          fontSize: 30,
          fontWeight: 600,
          textAlign: 'left'
        }
      }
    },
    {
      regionId: 'indicator',
      visible: true,
      title: {
        style: {
          text: '200',
          dx: 100,
          dy: 100,
          fontSize: 40,
          fontWeight: 800,
          textAlign: 'left',
          fill: '#AAA'
        }
      },
      content: {
        style: {
          text: 'offline tag',
          dx: 100,
          dy: 100,
          fill: '#AAA',
          fontSize: 30,
          fontWeight: 600,
          textAlign: 'left'
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[layout](link)
