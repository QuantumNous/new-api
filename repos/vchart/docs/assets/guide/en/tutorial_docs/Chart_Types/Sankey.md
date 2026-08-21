# Sankey Diagram

[\[Configuration manual\]](../../../option/sankeyChart)

## Introduction

Sankey diagrams can be used to display the flow, energy, materials, and other resources or processes in complex systems. They use a directed acyclic graph (DAG) structure, in which each node represents a particular state or event in the system, while the edges represent flows between two nodes (typically quantities or qualities in the system).

In a Sankey diagram, the size and color of the nodes are usually proportional to their importance and values. The width of the edges is also proportional to their associated values and typically has directional arrows. Nodes and edges can provide additional information through labels, legends, tooltips, etc.

Sankey diagrams are used in many fields, such as traffic analysis, energy management, material tracing, etc. They help people understand the complexity of systems, gather data, discover trends, etc.

## Chart Components

Sankey diagrams mainly consist of node and edge components, tooltips, and other components.
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda06.png)

Node and link components are essential elements of the Sankey diagram, and the relevant drawing configurations are indispensable:

- `sankeyChart.type`: Chart type. The Sankey diagram type is `'sankey'`.
- `sankeyChart.data`: Data source for chart drawing.
- `sankeyChart.categoryField`: Classification field, mapping different node components.
- `sankeyChart.valueField`: Value field, mapping the length of different node components.
- `sankeyChart.nodeAlign`: Node alignment type configuration.
- `sankeyChart.nodeGap`: Configuration for the gap size between two nodes at the same level.
- `sankeyChart.nodeWidth`: The width of each node.
- `sankeyChart.minNodeHeight`: The minimum size of the node when the data is non-zero or not empty. This configuration can be used to avoid nodes that are too small to be seen when the data is too small, and it's recommended to be less than 5px.

Tooltip and other components that assist in chart display are optional configurations with default effects and functions:

- `sankeyChart.tooltip`: Tooltip information. Default interaction is displayed. For detailed configuration, see the [VChart Tooltip Component Configuration](../../../option/sankeyChart#tooltip).
- For more component configurations, see [VChart sankeyChart Configuration](../../../option/sankeyChart).

## Quick Start

```javascript livedemo
const spec = {
  type: 'sankey',
  data: [
    {
      name: 'data',
      values: [
        {
          nodes: [
            {
              value: 100,
              name: 'A',
              children: [
                {
                  name: '上面',
                  value: 40,
                  children: [
                    { name: '00', value: 15 },
                    { name: '01', value: 10 },
                    { name: '02', value: 10 }
                  ]
                },
                {
                  name: '中间',
                  value: 30,
                  children: [
                    { name: '00', value: 10 },
                    { name: '01', value: 10 },
                    { name: '02', value: 10 }
                  ]
                },
                {
                  name: '下面',
                  value: 30
                }
              ]
            },
            {
              value: 80,
              name: 'B',
              children: [
                {
                  name: '上面',
                  value: 40,
                  children: [
                    { name: '00', value: 100 },
                    { name: '01', value: 40 }
                  ]
                },
                {
                  name: '中间',
                  value: 10
                },
                {
                  name: '下面',
                  value: 30
                }
              ]
            },
            {
              value: 50,
              name: 'C',
              children: [
                {
                  name: '上面',
                  value: 20
                },
                {
                  name: '中间',
                  value: 20
                },
                {
                  name: '下面',
                  value: 10
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',

  nodeAlign: 'left',
  nodeGap: 8,
  nodeWidth: 10,
  minNodeHeight: 4,
  nodeKey: datum => datum.name,

  label: {
    visible: true,
    state: {
      blur: {
        fill: '#e8e8e8',
        fillOpacity: 0.15
      }
    }
  },

  node: {
    state: {
      hover: {
        fill: 'red'
      },
      blur: {
        fill: '#e8e8e8',
        fillOpacity: 0.15
      }
    }
  },

  link: {
    backgroundStyle: { fill: '#ccc', fillOpacity: 0.2 },
    fillOpacity: 0.8,
    state: {
      hover: {
        stroke: '#000000'
      },
      blur: {
        fill: '#e8e8e8'
      }
    }
  },

  emphasis: {
    enable: true,
    effect: 'adjacency'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Key Configurations

- The `categoryField` property declares the category field, representing node names.
- The `valueField` property declares the value field, representing the weight of the relationship between nodes.
- `sourceField` and `targetField` properties do not need to be specified and are generated based on the hierarchical structure.
- The `nodeKey` property declares the resolution of the `key` value for nodes.

## Sankey Diagram Features

### Data

Since **Sankey diagrams use data structures to represent the relationships between nodes and edges**, we defined two ways to declare the data structure of Sankey diagrams in VChart:

1. Flat data structure for nodes and edges:

```ts
[
  {
    nodes: [{ nodeName: 'A' }, { nodeName: 'B' }, { nodeName: 'C' }],
    links: [
      { source: 0, target: 1, value: 1 },
      { source: 0, target: 2, value: 1 }
    ]
  }
];
```

2. Nested data structure for nodes and edges:

```ts
[
  {
    name: 'A',
    children: [
      { name: 'A-a', value: 1 },
      { name: 'A-b', value: 2 }
    ]
  },
  {
    name: 'B',
    children: [
      { name: 'B-a', value: 3 },
      { name: 'B-b', value: 4 }
    ]
  }
];
```

#### Flat Data

```javascript livedemo
const spec = {
  type: 'sankey',
  data: [
    {
      values: [
        {
          nodes: [
            { nodeName: 'A' },
            { nodeName: 'B' },
            { nodeName: 'C' },
            { nodeName: 'D' },
            { nodeName: 'E' },
            { nodeName: 'F' },
            { nodeName: 'G' }
          ],
          links: [
            { source: 'A', target: 'D', value: 400 },
            { source: 'B', target: 'D', value: 400 },
            { source: 'C', target: 'D', value: 500 },
            { source: 'D', target: 'F', value: 800 },
            { source: 'C', target: 'E', value: 100 },
            { source: 'E', target: 'G', value: 100 },
            { source: 'D', target: 'G', value: 500 }
          ]
        }
      ]
    }
  ],
  categoryField: 'nodeName',
  valueField: 'value',
  sourceField: 'source',
  targetField: 'target',
  nodeKey: 'nodeName',

  nodeAlign: 'justify',
  nodeGap: 8,
  nodeWidth: 10,
  minNodeHeight: 4,

  label: {
    visible: true,
    style: {
      fontSize: 10
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Nested Data

```javascript livedemo
const spec = {
  type: 'sankey',
  data: [
    {
      name: 'data',
      values: [
        {
          nodes: [
            {
              value: 100,
              name: 'A',
              children: [
                {
                  name: '上面',
                  value: 40,
                  children: [
                    { name: '00', value: 15 },
                    { name: '01', value: 10 },
                    { name: '02', value: 10 }
                  ]
                },
                {
                  name: '中间',
                  value: 30,
                  children: [
                    { name: '00', value: 10 },
                    { name: '01', value: 10 },
                    { name: '02', value: 10 }
                  ]
                },
                {
                  name: '下面',
                  value: 30
                }
              ]
            },
            {
              value: 80,
              name: 'B',
              children: [
                {
                  name: '上面',
                  value: 40,
                  children: [
                    { name: '00', value: 100 },
                    { name: '01', value: 40 }
                  ]
                },
                {
                  name: '中间',
                  value: 10
                },
                {
                  name: '下面',
                  value: 30
                }
              ]
            },
            {
              value: 50,
              name: 'C',
              children: [
                {
                  name: '上面',
                  value: 20
                },
                {
                  name: '中间',
                  value: 20
                },
                {
                  name: '下面',
                  value: 10
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',

  nodeAlign: 'left',
  nodeGap: 8,
  nodeWidth: 10,
  minNodeHeight: 4,
  nodeKey: datum => datum.name,

  label: {
    visible: true,
    state: {
      blur: {
        fill: '#e8e8e8',
        fillOpacity: 0.15
      }
    }
  },

  node: {
    state: {
      hover: {
        fill: 'red'
      },
      blur: {
        fill: '#e8e8e8',
        fillOpacity: 0.15
      }
    }
  },

  link: {
    backgroundStyle: { fill: '#ccc', fillOpacity: 0.2 },
    fillOpacity: 0.8,
    state: {
      hover: {
        stroke: '#000000'
      },
      blur: {
        fill: '#e8e8e8'
      }
    }
  },

  emphasis: {
    enable: true,
    effect: 'adjacency'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Chart Layout

The layout of the Sankey diagram is mainly reflected in the positional relationship between nodes. The following configurations can help you freely adjust the layout of the Sankey diagram:

- `nodeAlign`: Declare the alignment type for nodes. This property can be configured as `'left' | 'right' | 'center' | 'justify' | 'start' | 'end'`.
- `nodeGap`: Declare the gap size between two nodes at the same level.
- `nodeWidth`: Declare the width of each node. Supports three types of values:

1. Percentage string, e.g., `{ nodeWidth: '12%' }`
2. Simple number in pixels, e.g., `{ nodeWidth: 20 }`
3. Function, specify nodeWidth through custom calculation.

- The `minNodeHeight` property declares the minimum size of the node when the data is non-zero or not empty. This configuration can be used to avoid nodes that are too small to be seen when the data is too small, and it's recommended to be less than 5px.

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
    },
    padding: {
      bottom: 12
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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Sankey Diagram Labels

In Sankey diagrams, the position of the labels can be configured with `sankeyChart.label.position: 'outside' | 'inside-start' | 'inside-middle' | 'inside-end' | 'left' | 'right'`.

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
    // position: 'outside',
    // position: 'inside-start',
    // position: 'inside-middle',
    // position: 'inside-end',
    position: 'left',
    // position: 'right',
    style: {
      fontSize: 10
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Sankey Diagram Interaction

In general, the parent-child relationship and hierarchy in Sankey diagrams is represented by the connection of links. However, when the data set is complex and the hierarchy is deep, this method may not be clear enough. Therefore, in such cases, it is necessary to display the relationship between parent and child through clicking to better **understand the overall data flow and path information**.

In VChart, we can configure interactions with `sankeyChart.emphasis`.

- `sankeyChart.emphasis.trigger`: Declare the interaction trigger type. It can be configured as `'click' | 'hover'`, click or hover to trigger.
- `sankeyChart.emphasis.effect`: Declare the interaction linkage effect.
  Sankey diagrams offer three different interaction linkage effects on nodes:

1. self: Only highlight the current node;
2. adjacency: Highlight the upstream and downstream nodes and associated edges of the current node and fade other graphic elements;
3. related: Highlight the nodes and edges on the entire path related to the current node and fade other graphic elements.

```javascript livedemo
const spec = {
  type: 'sankey',
  data: [
    {
      values: [
        {
          nodes: [
            {
              name: 'Berlin'
            },
            {
              name: 'Job Applications'
            },
            {
              name: 'Barcelona'
            },
            {
              name: 'Madrid'
            },
            {
              name: 'Amsterdam'
            },
            {
              name: 'Paris'
            },
            {
              name: 'London'
            },
            {
              name: 'Munich'
            },
            {
              name: 'Brussels'
            },
            {
              name: 'Dubai'
            },
            {
              name: 'Dublin'
            },
            {
              name: 'Other Cities'
            },
            {
              name: 'No Response'
            },
            {
              name: 'Responded'
            },
            {
              name: 'Rejected'
            },
            {
              name: 'Interviewed'
            },
            {
              name: 'No Offer'
            },
            {
              name: 'Declined Offer'
            },
            {
              name: 'Accepted Offer'
            }
          ],
          links: [
            {
              source: 'Berlin',
              target: 'Job Applications',
              value: 102,
              color: '#dddddd'
            },
            {
              source: 'Barcelona',
              target: 'Job Applications',
              value: 39,
              color: '#dddddd'
            },
            {
              source: 'Madrid',
              target: 'Job Applications',
              value: 35,
              color: '#dddddd'
            },
            {
              source: 'Amsterdam',
              target: 'Job Applications',
              value: 15,
              color: '#dddddd'
            },
            {
              source: 'Paris',
              target: 'Job Applications',
              value: 14,
              color: '#dddddd'
            },
            {
              source: 'London',
              target: 'Job Applications',
              value: 6,
              color: '#dddddd'
            },
            {
              source: 'Munich',
              target: 'Job Applications',
              value: 5,
              color: '#dddddd'
            },
            {
              source: 'Brussels',
              target: 'Job Applications',
              value: 4,
              color: '#dddddd'
            },
            {
              source: 'Dubai',
              target: 'Job Applications',
              value: 3,
              color: '#dddddd'
            },
            {
              source: 'Dublin',
              target: 'Job Applications',
              value: 3,
              color: '#dddddd'
            },
            {
              source: 'Other Cities',
              target: 'Job Applications',
              value: 12,
              color: '#dddddd'
            },
            {
              source: 'Job Applications',
              target: 'No Response',
              value: 189,
              color: '#dddddd'
            },
            {
              source: 'Job Applications',
              target: 'Responded',
              value: 49,
              color: 'orange'
            },
            {
              source: 'Responded',
              target: 'Rejected',
              value: 38,
              color: '#dddddd'
            },
            {
              source: 'Responded',
              target: 'Interviewed',
              value: 11,
              color: 'orange'
            },
            {
              source: 'Interviewed',
              target: 'No Offer',
              value: 8,
              color: '#dddddd'
            },
            {
              source: 'Interviewed',
              target: 'Declined Offer',
              value: 2,
              color: '#dddddd'
            },
            {
              source: 'Interviewed',
              target: 'Accepted Offer',
              value: 1,
              color: 'orange'
            }
          ]
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  sourceField: 'source',
  targetField: 'target',

  nodeAlign: 'justify',
  nodeGap: 8,
  nodeWidth: 15,
  minNodeHeight: 4,
  nodeKey: datum => datum.name,
  iterations: 20,

  title: {
    text: 'Job application process'
  },

  label: {
    visible: true,
    style: {
      fontSize: 10,
      fill: 'black'
    },
    state: {
      blur: {
        fill: '#e8e8e8',
        fillOpacity: 0.15
      }
    }
  },

  node: {
    style: {
      fill: '#b9b9b9',
      stroke: 'white',
      lineWidth: 1,
      strokeOpacity: 1
    },
    state: {
      hover: {
        fill: 'red',
        fillOpacity: 1
      },
      selected: {
        fill: '#dddddd',
        stroke: '#333333',
        lineWidth: 1,
        fillOpacity: 1
      },
      blur: {
        fillOpacity: 0.05,
        strokeOpacity: 0.05
      }
    }
  },

  link: {
    style: {
      fill: data => {
        return data.color ?? data.datum.color;
      },
      fillOpacity: 1
    },
    state: {
      hover: {
        fillOpacity: 1
      },
      selected: {
        fillOpacity: 1
      },
      blur: {
        fillOpacity: 0.05
      }
    }
  },

  emphasis: {
    enable: true,
    effect: 'adjacency'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
