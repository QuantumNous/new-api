---
category: examples
group: sankey chart
title: Interactive Sankey Diagram
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/sankey-chart/interection-sankey.png
option: sankeyChart
---

# Interactive Sankey Diagram

A Sankey diagram is a schematic diagram that shows the flow of data from one set of values to another. The width of the branches corresponds to the flow size of the data. This chart displays the recruiting workflow.

## Key option

- The `emphasis` property declares the interactive configuration
- The `emphasis.trigger` property declares the type of interaction trigger. It can be configured as `trigger?: 'click' | 'hover'`, click trigger or hover trigger
- The `emphasis.effect` property declares the interactive linkage effect. The Sankey chart provides 3 types of interactive linkage effects on nodes: 1.self: Only highlight the current node; 2.adjacency: Highlight the upstream and downstream nodes and associated edges of the current node, dimming other graphic elements; 3.related: Highlight the nodes and edges on the entire path related to the current node, dimming other graphic elements.
- The `iterations` property declares the layout iteration count

## Demo source

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Sankey Chart](link)
