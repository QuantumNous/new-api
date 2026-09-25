---
category: examples
group: sankey chart
title: 桑基图指定节点宽高
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-8
cover: /vchart/preview/sankey-chart-specified-node-1.11.0.png
option: sankeyChart
---

# Sankey Chart Specified Node Width and Height

Sankey chart can specify the width and height of nodes through corresponding configurations, combined with the ability to customize the mark `extensionMark` to achieve a similar effect to the indicator card Sankey chart.

## Key Configurations

- `dropIsolatedNode` Whether to discard isolated nodes, which are points without sources or destinations
- `nodeWidth` Specify the width of nodes
- `equalNodeHeight` Specify that the height of nodes is uniformly calculated, not mapped according to the data values
- `linkOverlap` Specify the layout of edges as overlapping layout, with the alignment point being the center point

## Code Demo

```javascript livedemo
const nodes = [
  { name: 'Opportunity Group' },
  { name: 'High Potential User 0' },
  { name: 'High Potential User' },
  { name: 'Repeat Loyalty' },
  { name: 'First Course New Order' },
  { name: 'Secondary Purchase Loyalty' },
  { name: 'Others', value: 199999 },
  { name: 'First Order New Customer', value: 999 }
];

const spec = {
  type: 'sankey',
  data: [
    {
      id: 'sankeyData',
      values: [
        {
          nodes: nodes,
          links: [
            {
              source: 'Opportunity Group',
              target: 'High Potential User',
              value: 199999
            },
            {
              source: 'High Potential User 0',
              target: 'High Potential User',
              value: 299999
            },
            {
              source: 'First Course New Order',
              target: 'High Potential User',
              value: 399999
            },
            {
              source: 'First Course New Order',
              target: 'Repeat Loyalty',
              value: 499999
            },
            {
              source: 'Secondary Purchase Loyalty',
              target: 'High Potential User',
              value: 599999
            }
          ]
        }
      ]
    },
    {
      id: 'sankeyNodes',
      values: nodes
    }
  ],
  dataId: 'sankeyData',
  categoryField: 'name',
  valueField: 'value',
  sourceField: 'source',
  targetField: 'target',
  // nodeAlign: 'justify',

  dropIsolatedNode: false,
  nodeGap: 2,
  nodeWidth: 200,

  // nodeHeight: 100,
  equalNodeHeight: true,
  linkOverlap: 'center',

  title: {
    text: 'How energy is converted or transmitted before being consumed or lost',
    subtext: 'Data: Department of Energy & Climate Change via Tom Counsell',
    subtextStyle: {
      fontSize: 12
    }
  },
  label: {
    visible: false,
    style: {
      fontSize: 10
    }
  },
  node: {
    state: {
      hover: {
        stroke: '#333333'
      },
      selected: {
        lineWidth: 1,
        brighter: 1,
        fillOpacity: 0.1
      }
    },
    style: {
      fill: '#1664FF',
      fillOpacity: 0,
      lineWidth: 1,
      stroke: '#1664FF'
    }
  },
  link: {
    style: {
      fill: '#1664FF'
    },
    state: {
      hover: {
        fillOpacity: 1
      },
      selected: {
        fill: '#1664FF',
        stroke: '',
        lineWidth: 1,
        brighter: 1,
        fillOpacity: 0.2
      }
    }
  },
  extensionMark: [
    {
      type: 'text',
      dataId: 'sankeyNodes',
      dataKey: 'name',
      visible: true,
      state: {
        hover: {
          fill: '#1664FF'
        }
      },
      style: {
        stroke: false,
        x: (datum, ctx, elements, dataView) => {
          console.log(datum, ctx, elements, dataView);
          return ctx.valueToX([datum.name]) + 10;
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToY([datum.name]) + 10;
        },
        text: (datum, ctx, elements, dataView) => {
          const node = ctx.valueToNode([datum.name]);

          return {
            type: 'rich',
            text: [
              {
                text: `${datum.name}\n`,
                fill: '#646475',
                lineHeight: 18,
                fontWeight: 500,
                fontSize: 12
              },
              {
                text: node.value,
                fill: '#1d1d2e',
                lineHeight: 28,
                fontWeight: 700,
                fontSize: 28
              }
            ]
          };
        },
        textAlign: 'left'
      }
    },
    {
      type: 'rect',
      dataId: 'sankeyNodes',
      dataKey: 'name',
      visible: true,
      style: {
        fill: '#1664FF',
        x: (datum, ctx, elements, dataView) => {
          return ctx.valueToNode([datum.name]).x1 - 10;
        },
        y: (datum, ctx, elements, dataView) => {
          return ctx.valueToNode([datum.name]).y0;
        },
        y1: (datum, ctx, elements, dataView) => {
          return ctx.valueToNode([datum.name]).y1;
        },
        width: 10
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[桑基图](link)
