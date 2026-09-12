---
category: examples
group: sankey chart
title: 桑基图指定节点宽高
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-8
cover: /vchart/preview/sankey-chart-specified-node-1.11.0.png
option: sankeyChart
---

# 桑基图指定节点宽高

桑基图可以通过相应的配置，指定节点的宽度、高度，结合自定义 mark`extensionMark`的能力实现类似于指标卡桑基图的效果

## 关键配置

- `dropIsolatedNode` 是否抛弃孤点，也就是没有来源去向的点
- `nodeWidth` 指定节点的宽度
- `equalNodeHeight` 指定节点的高度为均匀计算，不按照数据的值进行映射
- `linkOverlap` 指定边的布局方式为重叠布局，布局对齐点为中心点

## 代码演示

```javascript livedemo
const nodes = [
  { name: '机会人群' },
  { name: '高潜用户0' },
  { name: '高潜用户' },
  { name: '复购忠诚' },
  { name: '首课新单' },
  { name: '副购忠诚' },
  { name: '其他', value: 199999 },
  { name: '首单新客', value: 999 }
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
              source: '机会人群',
              target: '高潜用户',
              value: 199999
            },
            {
              source: '高潜用户0',
              target: '高潜用户',
              value: 299999
            },
            {
              source: '首课新单',
              target: '高潜用户',
              value: 399999
            },
            {
              source: '首课新单',
              target: '复购忠诚',
              value: 499999
            },
            {
              source: '副购忠诚',
              target: '高潜用户',
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
  nodeKey: 'name',
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
