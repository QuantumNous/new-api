---
category: examples
group: sankey chart
title: 交互桑基图
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/sankey-chart/interection-sankey.png
option: sankeyChart
---

# 交互桑基图

桑基图是一种表现流程的示意图，用于描述一组值到另一组值的流向。分支的宽度对应了数据流量的大小。
这张图显示了招聘工作流。

## 关键配置

- `emphasis`属性声明交互配置
- `emphasis.trigger` 属性声明交互触发类型。可以配置为 `trigger?: 'click' | 'hover'` , 点击触发或悬浮触发
- `emphasis.effect` 属性声明交互联动效果。桑基图提供 3 种在节点上的交互联动效果：1.self: 仅高亮当前节点；2.adjacency: 高亮当前节点上下游节点和关联的边，淡化其它图形元素；3.related： 高亮与当前节点相关的整条路径上的节点和边，淡化其它图形元素。
- `iterations` 属性声明布局迭代次数

## 代码演示

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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[桑基图](link)
