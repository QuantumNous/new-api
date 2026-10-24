---
category: examples
group: sankey chart
title: Sankey Diagram Multiple Edge Configurations
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-7
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/sankey-chart-d3.jpeg
option: sankeyChart
---

# Sankey Diagram Multiple Link Configurations

The links of a Sankey diagram have a source node and an end node (source), and nodes can be represented in two forms:

- By default, the index value of nodes is used.
- By configuring the callback function of nodeKey, use the node name as the starting and ending nodes of the edge.
  This example uses the callback function of nodeKey as the node configuration of the edge.

## Key option

- `categoryField` Properties are declared as category fields representing node names
- `valueField` A property declaration numeric field representing the weight of the relationship between nodes
- `sourceField` Property declaration numeric field representing the source node index
- `targetField` Property declaration numeric field representing the target node index
- `nodeAlign` The property declares the alignment type of the node, which can be configured as'left '|' right '|' center '|' justify '|' start '|' end '
- `nodeGap` Property declares the size of the gap between two nodes in the same layer
- `nodeWidth` The property declares the width of each node and supports three values: 1. Percentage string, for example `{ nodeWidth: '12%' }`; 2. Simple numbers in'px ', eg `{ nodeWidth: 20 }`3. function, specify nodeWidth by custom calculation
- `minNodeHeight` The attribute declares the minimum size of the node when the data is not zero or empty. This configuration can be used to avoid nodes that cannot be seen too thin when the data is too small. It is recommended to be less than 5px.
- `label` Attribute declaration label configuration, label layout can be configured as`position: 'outside' | 'inside-start' | 'inside-middle' | 'inside-end' | 'left' | 'right'`, the maximum abbreviated length of label text can be used `limit` configuration
- `node` Properties declare the style configuration of nodes in different states
- `link` Properties declare the style configuration in different states

## Demo source

```javascript livedemo
const data = [
  {
    nodes: [
      { name: 'Bight of Benin', category: 'Bight' },
      { name: 'Brazil', category: 'Brazil' },
      { name: 'Bight of Biafra and Gulf of Guinea islands', category: 'Bight' },
      { name: 'Gold Coast', category: 'Gold' },
      { name: 'Others Dep.', category: 'Others' },
      { name: 'Senegambia and offshore Atlantic', category: 'Senegambia' },
      { name: 'Sierra Leone e Windward Coast', category: 'Sierra' },
      { name: 'Southeast Africa and Indian Ocean islands', category: 'Southeast' },
      { name: 'West Central Africa and St. Helena', category: 'West' },
      { name: 'Caribbean', category: 'Caribbean' },
      { name: 'Mainland North America', category: 'Mainland' },
      { name: 'Others Arr', category: 'Others' },
      { name: 'Spanish American Mainland', category: 'Spanish' }
    ],
    links: [
      { target: 'Brazil', source: 'Bight of Benin', value: 733769 },
      { target: 'Brazil', source: 'Bight of Biafra and Gulf of Guinea islands', value: 98256 },
      { target: 'Brazil', source: 'Gold Coast', value: 40507 },
      { target: 'Brazil', source: 'Others Dep.', value: 18627 },
      { target: 'Brazil', source: 'Senegambia and offshore Atlantic', value: 86001 },
      { target: 'Brazil', source: 'Sierra Leone e Windward Coast', value: 5409 },
      { target: 'Brazil', source: 'Southeast Africa and Indian Ocean islands', value: 232940 },
      { target: 'Brazil', source: 'West Central Africa and St. Helena', value: 1818611 },
      { target: 'Caribbean', source: 'Bight of Benin', value: 494753 },
      { target: 'Caribbean', source: 'Bight of Biafra and Gulf of Guinea islands', value: 678927 },
      { target: 'Caribbean', source: 'Gold Coast', value: 517280 },
      { target: 'Caribbean', source: 'Others Dep.', value: 192389 },
      { target: 'Caribbean', source: 'Senegambia and offshore Atlantic', value: 144125 },
      { target: 'Caribbean', source: 'Sierra Leone e Windward Coast', value: 284412 },
      { target: 'Caribbean', source: 'Southeast Africa and Indian Ocean islands', value: 57138 },
      { target: 'Caribbean', source: 'West Central Africa and St. Helena', value: 793963 },
      { target: 'Mainland North America', source: 'Bight of Benin', value: 7153 },
      { target: 'Mainland North America', source: 'Bight of Biafra and Gulf of Guinea islands', value: 39389 },
      { target: 'Mainland North America', source: 'Gold Coast', value: 26918 },
      { target: 'Mainland North America', source: 'Others Dep.', value: 12532 },
      { target: 'Mainland North America', source: 'Senegambia and offshore Atlantic', value: 49118 },
      { target: 'Mainland North America', source: 'Sierra Leone e Windward Coast', value: 40366 },
      { target: 'Mainland North America', source: 'Southeast Africa and Indian Ocean islands', value: 3958 },
      { target: 'Mainland North America', source: 'West Central Africa and St. Helena', value: 62966 },
      { target: 'Others Arr', source: 'Bight of Benin', value: 40607 },
      { target: 'Others Arr', source: 'Bight of Biafra and Gulf of Guinea islands', value: 34687 },
      { target: 'Others Arr', source: 'Gold Coast', value: 2108 },
      { target: 'Others Arr', source: 'Others Dep.', value: 1499 },
      { target: 'Others Arr', source: 'Senegambia and offshore Atlantic', value: 8435 },
      { target: 'Others Arr', source: 'Sierra Leone e Windward Coast', value: 12793 },
      { target: 'Others Arr', source: 'Southeast Africa and Indian Ocean islands', value: 9924 },
      { target: 'Others Arr', source: 'West Central Africa and St. Helena', value: 50046 },
      { target: 'Spanish American Mainland', source: 'Bight of Benin', value: 15822 },
      { target: 'Spanish American Mainland', source: 'Bight of Biafra and Gulf of Guinea islands', value: 13700 },
      { target: 'Spanish American Mainland', source: 'Gold Coast', value: 5030 },
      { target: 'Spanish American Mainland', source: 'Others Dep.', value: 5155 },
      { target: 'Spanish American Mainland', source: 'Senegambia and offshore Atlantic', value: 44889 },
      { target: 'Spanish American Mainland', source: 'Sierra Leone e Windward Coast', value: 326 },
      { target: 'Spanish American Mainland', source: 'Southeast Africa and Indian Ocean islands', value: 14327 },
      { target: 'Spanish American Mainland', source: 'West Central Africa and St. Helena', value: 131837 }
    ],
    units: 'Escravos'
  }
];

const spec = {
  type: 'sankey',
  data: [
    {
      name: 'data',
      values: data
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  sourceField: 'source',
  targetField: 'target',
  colorField: 'type',
  nodeKey: datum => datum.name,

  label: {
    visible: true,
    style: {
      fontSize: 12,
      fill: '#000000',
      limit: 10000
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
    style: {
      fillOpacity: 0.1
    },
    state: {
      hover: {
        fillOpacity: 0.4
      },
      blur: {
        fill: '#e8e8e8'
      }
    }
  },
  emphasis: {
    enable: true,
    trigger: 'selected',
    effect: 'adjacency'
  },
  title: {
    text: 'From Where in Africa Were the Slaves Who Landed in Va.?',
    subtext: 'Source: https://observablehq.com/@luiztheodoro/sankey-d3',
    subtextStyle: {
      fontSize: 12
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Sanki diagram](link)
