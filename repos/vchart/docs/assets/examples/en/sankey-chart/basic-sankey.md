---
category: examples
group: sankey chart
title: Basic Sankey Chart
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/23e5d313c2c3a66d4ca806000.png
option: sankeyChart
---

# Basic Sankey Chart

A Sankey diagram is a flow diagram that shows how values flow from one set to another. The width of the branches corresponds to the size of the data flow.
This chart shows how energy is converted or transmitted before being consumed or lost: supply on the left and demand on the right.

## Key option

- `categoryField` property declares the category field, representing the node name
- `valueField` property declares the numeric field, representing the weight of the relationships between nodes
- `sourceField` property declares the numeric field, representing the source node index
- `targetField` property declares the numeric field, representing the target node index
- `nodeAlign` property declares the alignment type of the nodes, this attribute can be set to 'left' | 'right' | 'center' | 'justify' | 'start' | 'end'
- `nodeGap` property declares the size of the gap between two nodes within the same layer
- `nodeWidth` property declares the width of each node, supporting three types of values: 1. Percentage string, such as `{ nodeWidth: '12%' }`; 2. Simple number with 'px' as the unit, such as `{ nodeWidth: 20 }`; 3. Function, specifying nodeWidth through custom calculation
- `minNodeHeight` property declares the minimum size of a node when the data is not zero or empty, this configuration can be used to avoid nodes that are too small to be seen when the data is too small, preferably less than 5px
- `label` property declares label configuration, label layout can be set to `position: 'outside' | 'inside-start' | 'inside-middle' | 'inside-end' | 'left' | 'right'`, label text maximum abbreviation length can be set using `limit` configuration
- `node` property declares the styling configuration for nodes in different states
- `link` property declares the styling configuration for edges in different states

## Demo source

```javascript livedemo
const spec = {
  type: 'sankey',
  data: [
    {
      values: [
        {
          nodes: [
            { nodeName: "Agricultural 'waste'" },
            { nodeName: 'Bio-conversion' },
            { nodeName: 'Liquid' },
            { nodeName: 'Losses' },
            { nodeName: 'Solid' },
            { nodeName: 'Gas' },
            { nodeName: 'Biofuel imports' },
            { nodeName: 'Biomass imports' },
            { nodeName: 'Coal imports' },
            { nodeName: 'Coal' },
            { nodeName: 'Coal reserves' },
            { nodeName: 'District heating' },
            { nodeName: 'Industry' },
            { nodeName: 'Heating and cooling - commercial' },
            { nodeName: 'Heating and cooling - homes' },
            { nodeName: 'Electricity grid' },
            { nodeName: 'Over generation / exports' },
            { nodeName: 'H2 conversion' },
            { nodeName: 'Road transport' },
            { nodeName: 'Agriculture' },
            { nodeName: 'Rail transport' },
            { nodeName: 'Lighting & appliances - commercial' },
            { nodeName: 'Lighting & appliances - homes' },
            { nodeName: 'Gas imports' },
            { nodeName: 'Ngas' },
            { nodeName: 'Gas reserves' },
            { nodeName: 'Thermal generation' },
            { nodeName: 'Geothermal' },
            { nodeName: 'H2' },
            { nodeName: 'Hydro' },
            { nodeName: 'International shipping' },
            { nodeName: 'Domestic aviation' },
            { nodeName: 'International aviation' },
            { nodeName: 'National navigation' },
            { nodeName: 'Marine algae' },
            { nodeName: 'Nuclear' },
            { nodeName: 'Oil imports' },
            { nodeName: 'Oil' },
            { nodeName: 'Oil reserves' },
            { nodeName: 'Other waste' },
            { nodeName: 'Pumped heat' },
            { nodeName: 'Solar PV' },
            { nodeName: 'Solar Thermal' },
            { nodeName: 'Solar' },
            { nodeName: 'Tidal' },
            { nodeName: 'UK land based bioenergy' },
            { nodeName: 'Wave' },
            { nodeName: 'Wind' }
          ],
          links: [
            { source: 0, target: 1, value: 124.729 },
            { source: 1, target: 2, value: 0.597 },
            { source: 1, target: 3, value: 26.862 },
            { source: 1, target: 4, value: 280.322 },
            { source: 1, target: 5, value: 81.144 },
            { source: 6, target: 2, value: 35 },
            { source: 7, target: 4, value: 35 },
            { source: 8, target: 9, value: 11.606 },
            { source: 10, target: 9, value: 63.965 },
            { source: 9, target: 4, value: 75.571 },
            { source: 11, target: 12, value: 10.639 },
            { source: 11, target: 13, value: 22.505 },
            { source: 11, target: 14, value: 46.184 },
            { source: 15, target: 16, value: 104.453 },
            { source: 15, target: 14, value: 113.726 },
            { source: 15, target: 17, value: 27.14 },
            { source: 15, target: 12, value: 342.165 },
            { source: 15, target: 18, value: 37.797 },
            { source: 15, target: 19, value: 4.412 },
            { source: 15, target: 13, value: 40.858 },
            { source: 15, target: 3, value: 56.691 },
            { source: 15, target: 20, value: 7.863 },
            { source: 15, target: 21, value: 90.008 },
            { source: 15, target: 22, value: 93.494 },
            { source: 23, target: 24, value: 40.719 },
            { source: 25, target: 24, value: 82.233 },
            { source: 5, target: 13, value: 0.129 },
            { source: 5, target: 3, value: 1.401 },
            { source: 5, target: 26, value: 151.891 },
            { source: 5, target: 19, value: 2.096 },
            { source: 5, target: 12, value: 48.58 },
            { source: 27, target: 15, value: 7.013 },
            { source: 17, target: 28, value: 20.897 },
            { source: 17, target: 3, value: 6.242 },
            { source: 28, target: 18, value: 20.897 },
            { source: 29, target: 15, value: 6.995 },
            { source: 2, target: 12, value: 121.066 },
            { source: 2, target: 30, value: 128.69 },
            { source: 2, target: 18, value: 135.835 },
            { source: 2, target: 31, value: 14.458 },
            { source: 2, target: 32, value: 206.267 },
            { source: 2, target: 19, value: 3.64 },
            { source: 2, target: 33, value: 33.218 },
            { source: 2, target: 20, value: 4.413 },
            { source: 34, target: 1, value: 4.375 },
            { source: 24, target: 5, value: 122.952 },
            { source: 35, target: 26, value: 839.978 },
            { source: 36, target: 37, value: 504.287 },
            { source: 38, target: 37, value: 107.703 },
            { source: 37, target: 2, value: 611.99 },
            { source: 39, target: 4, value: 56.587 },
            { source: 39, target: 1, value: 77.81 },
            { source: 40, target: 14, value: 193.026 },
            { source: 40, target: 13, value: 70.672 },
            { source: 41, target: 15, value: 59.901 },
            { source: 42, target: 14, value: 19.263 },
            { source: 43, target: 42, value: 19.263 },
            { source: 43, target: 41, value: 59.901 },
            { source: 4, target: 19, value: 0.882 },
            { source: 4, target: 26, value: 400.12 },
            { source: 4, target: 12, value: 46.477 },
            { source: 26, target: 15, value: 525.531 },
            { source: 26, target: 3, value: 787.129 },
            { source: 26, target: 11, value: 79.329 },
            { source: 44, target: 15, value: 9.452 },
            { source: 45, target: 1, value: 182.01 },
            { source: 46, target: 15, value: 19.013 },
            { source: 47, target: 15, value: 289.366 }
          ]
        }
      ]
    }
  ],
  categoryField: 'nodeName',
  valueField: 'value',
  sourceField: 'source',
  targetField: 'target',

  nodeAlign: 'justify',
  nodeGap: 8,
  nodeWidth: 10,
  minNodeHeight: 4,

  title: {
    text: 'How energy is converted or transmitted before being consumed or lost',
    subtext: 'Data: Department of Energy & Climate Change via Tom Counsell',
    subtextStyle: {
      fontSize: 12
    }
  },

  label: {
    visible: true,
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
        fill: '#dddddd',
        stroke: '#333333',
        lineWidth: 1,
        brighter: 1,
        fillOpacity: 1
      }
    }
  },

  link: {
    state: {
      hover: {
        fillOpacity: 1
      },
      selected: {
        fill: '#dddddd',
        stroke: '#333333',
        lineWidth: 1,
        brighter: 1,
        fillOpacity: 1
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorial

[Sankey Chart](link)
