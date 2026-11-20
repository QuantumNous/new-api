---
category: examples
group: sankey chart
title: 层级桑基图
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/sankey-chart/hierarchical-sankey.png
option: sankeyChart
---

# 层级桑基图

层级桑基图是指输入数据为层级数据所绘制的桑基图。区别于基础桑基图节点与边构成的数据格式，层级桑基图的输入数据为逐级向下递归的层级数据。
在层级数据下，交互效果支持根据数据的流入情况可以支持边的部分高亮的情况。例如在这个例子中，点击 A 节点，“top-00"边仅高亮从 A 节点流出的部分。

## 关键配置

- `categoryField` 属性声明为类别字段，表示节点名称
- `valueField` 属性声明数值字段，表示节点之间关系的权重
- `sourceField` 和 `targetField` 属性不需要指定，根据层级结构生成
- `nodeKey` 属性声明解析节点的 `key` 值

## 代码演示

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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[桑基图](link)
