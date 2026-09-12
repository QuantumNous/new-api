---
category: examples
group: sankey chart
title: Hierarchical Sankey Chart
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/sankey-chart/hierarchical-sankey.png
option: sankeyChart
---

# Hierarchical Sankey Chart

Hierarchical Sankey Chart refers to the Sankey Chart drawn with the input data as hierarchical data. Different from the data format composed of nodes and edges in the basic Sankey Chart, the input data of the hierarchical Sankey Chart is hierarchical data that recursively goes down level by level.
Under hierarchical data, the interactive effect supports partial highlighting of edges based on the inflow of data. For example, in this example, click on the A node, and the "top-00" edge will only highlight the part flowing from the A node.

## Key Configuration

- The `categoryField` attribute is declared as the category field, representing the node name
- The `valueField` attribute is declared as the value field, representing the weight of the relationship between nodes
- The `sourceField` and `targetField` attributes do not need to be specified, they are generated according to the hierarchical structure
- The `nodeKey` attribute declares the `key` value for parsing nodes

## Demo source

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
                  name: 'top',
                  value: 40,
                  children: [
                    { name: '00', value: 15 },
                    { name: '01', value: 10 },
                    { name: '02', value: 10 }
                  ]
                },
                {
                  name: 'middle',
                  value: 30,
                  children: [
                    { name: '00', value: 10 },
                    { name: '01', value: 10 },
                    { name: '02', value: 10 }
                  ]
                },
                {
                  name: 'bottom',
                  value: 30
                }
              ]
            },
            {
              value: 80,
              name: 'B',
              children: [
                {
                  name: 'top',
                  value: 40,
                  children: [
                    { name: '00', value: 100 },
                    { name: '01', value: 40 }
                  ]
                },
                {
                  name: 'middle',
                  value: 10
                },
                {
                  name: 'bottom',
                  value: 30
                }
              ]
            },
            {
              value: 50,
              name: 'C',
              children: [
                {
                  name: 'top',
                  value: 20
                },
                {
                  name: 'middle',
                  value: 20
                },
                {
                  name: 'bottom',
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
    effect: 'related'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Related Tutorials

[Sankey Chart](link)
