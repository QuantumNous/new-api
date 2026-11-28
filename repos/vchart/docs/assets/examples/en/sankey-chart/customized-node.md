---
category: examples
group: sankey chart
title: 桑基图自定义html渲染节点
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-9
cover: /vchart/preview/sankey-chart-customized-node-1.11.0.png
option: sankeyChart
---

# Customized HTML Rendering Nodes for Sankey Chart

Sankey chart can specify the width and height of nodes through corresponding configurations, combined with the vrender extended attribute `html` to achieve the indicator card Sankey chart.

## Key Configurations

- `dropIsolatedNode` whether to discard isolated nodes, that is, nodes without sources or targets
- `nodeWidth` specifies the width of nodes
- `equalNodeHeight` specifies that the height of nodes is uniformly calculated, not mapped according to the data values
- `linkOverlap` specifies the layout of edges as overlapping layout, with the alignment point being the center point
- `node.style.html` sets the html content for rendering nodes

## Code Demo

```javascript livedemo
const spec = {
  type: 'sankey',
  data: [
    {
      id: 'sankeyData',
      values: [
        {
          links: [
            {
              source: 'Opportunity Audience',
              target: 'High Potential Users',
              value: 199999
            },
            {
              source: 'High Potential User 0',
              target: 'High Potential Users',
              value: 299999
            },
            {
              source: 'First Course New Order',
              target: 'High Potential Users',
              value: 399999
            },
            {
              source: 'First Course New Order',
              target: 'Repeat Loyalty',
              value: 499999
            },
            {
              source: 'Deputy Purchase Loyalty',
              target: 'High Potential Users',
              value: 599999
            },
            {
              source: 'Others',
              value: 199999
            },
            {
              target: 'First Order New Customer',
              value: 999
            }
          ]
        }
      ]
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
      stroke: '#1664FF',
      html: (datum, a, c) => {
        const color = '#1664FF';
        const hasSource = datum.targetLinks && datum.targetLinks.length;

        return {
          style: ({ width, height }) => {
            return {
              'border-right': `8px solid ${color}`,
              width: `${width}px`,
              height: `${height}px`,
              background: hasSource ? color : 'transparent'
            };
          },
          dom: `<div style="margin: 10px 0 0 10px;">
              <p style="
              margin:0;
              font-weight:500;
              line-height: 18px;
              font-size:12px;
              color:${hasSource ? '#fff' : '#646475'};
              ">${datum.key}</p>
              <p style="margin:0;font-weight: 700;
              font-size: 20px;
              line-height: 28px;
              color: ${hasSource ? '#fff' : '#1d1d2e'};">${datum.value}</p>
            </div>`
        };
      }
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
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, enableHtmlAttribute: true });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[桑基图](link)
