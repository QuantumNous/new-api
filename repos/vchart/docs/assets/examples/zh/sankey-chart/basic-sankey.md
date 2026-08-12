---
category: examples
group: sankey chart
title: 基础桑基图
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/57a706137957fce7388f3ab02.png
option: sankeyChart
---

# 基础桑基图

桑基图是一种表现流程的示意图，用于描述一组值到另一组值的流向。分支的宽度对应了数据流量的大小。
这张图显示了能量在被消耗或丢失之前是如何转换或传输的：供应在左边，需求在右边。

## 关键配置

- `categoryField` 属性声明为类别字段，表示节点名称
- `valueField` 属性声明数值字段，表示节点之间关系的权重
- `sourceField` 属性声明数值字段，表示来源节点索引
- `targetField` 属性声明数值字段，表示目标节点索引
- `nodeAlign` 属性声明节点的对齐类型，该属性可以配置为'left' | 'right' | 'center' | 'justify' | 'start' | 'end'
- `nodeGap` 属性声明同一层中两个节点之间的间隙大小
- `nodeWidth` 属性声明每个节点的宽度，支持三种取值: 1. 百分比字符串，例如 `{ nodeWidth: '12%' }`；2. 以'px'为单位的简单数字，例如 `{ nodeWidth: 20 }`；3. function，通过自定义计算指定 nodeWidth
- `minNodeHeight` 属性声明数据不为零或空时节点的最小大小，这个配置可以用来避免数据太小时看不到太细的节点，建议小于 5px
- `label` 属性声明标签配置，标签布局方式可配置为`position: 'outside' | 'inside-start' | 'inside-middle' | 'inside-end' | 'left' | 'right'`，标签文字最大缩略长度可使用 `limit` 配置
- `node` 属性声明不同状态下节点的样式配置
- `link` 属性声明不同状态下边的样式配置

## 代码演示

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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[桑基图](link)
