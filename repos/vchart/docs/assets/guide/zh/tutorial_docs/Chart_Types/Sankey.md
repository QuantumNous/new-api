# 桑基图

[\[配置项\]](../../../option/sankeyChart)

## 简介

桑基图可用于显示复杂系统中的流量、能量、材料等各种资源或流程。它使用有向无环图（DAG）结构，其中各个节点表示系统中的某些状态或事件，而边表示两个节点之间的流（通常在系统中是量与质）。

在桑基图中，节点的大小和颜色通常与其重要性和值成比例。边的宽度也与其相关的值成比例，通常还有带箭头的方向。节点和边可以用标签、图例、工具提示等方式来提供附加信息。

桑基图在许多领域中都有应用，如流量分析、能源管理、材料追溯等等。它可以帮助人们理解系统的复杂性、收集数据、发现趋势等。

## 图表构成

桑基图主要由节点图元和边图元、提示信息及其他组件构成。  
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda06.png)

node 图元、link 图元为桑基图的基本要素，相关的绘制配置必不可少:

- `sankeyChart.type`: 图表类型，桑基图的类型为`'sankey'`
- `sankeyChart.data`: 图表绘制的数据源
- `sankeyChart.categoryField`: 分类字段，映射不同节点图元
- `sankeyChart.valueField`: 数值字段，映射不同节点图元的长度
- `sankeyChart.nodeAlign`: 节点对齐类型配置
- `sankeyChart.nodeGap`: 同一层中两个节点之间的间隙大小配置
- `sankeyChart.nodeWidth`: 每个节点的宽度
- `sankeyChart.minNodeHeight`: 数据不为零或空时节点的最小大小，这个配置可以用来避免数据太小时看不到太细的节点，建议小于 5px

提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `sankeyChart.tooltip`: 提示信息，默认交互时显示，详细配置见详细配置见[VChart 提示信息组件配置](../../../option/sankeyChart#tooltip)
- 更多组件配置见[VChart sankeyChart 配置](../../../option/sankeyChart)

## 快速上手

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
    effect: 'adjacency'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 关键配置

- `categoryField` 属性声明为类别字段，表示节点名称
- `valueField` 属性声明数值字段，表示节点之间关系的权重
- `sourceField` 和 `targetField` 属性不需要指定，根据层级结构生成
- `nodeKey` 属性声明解析节点的 `key` 值

## 桑基图特性

### 数据

由于**桑基图用数据结构表示节点与边的关系**，所以在 VChart 中，我们定义了两种方式桑基图数据结构声明方式：

1.节点与边的平坦化数据结构：

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

2.节点与边的嵌套数据结构：

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

#### 平坦化数据

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

#### 嵌套数据

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
    effect: 'adjacency'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 图表布局

桑基图的布局主要体现在节点之间的位置关系上，下列配置可以帮助您自由调整桑基图布局：

- `nodeAlign`: 声明节点的对齐类型，该属性可以配置为`'left' | 'right' | 'center' | 'justify' | 'start' | 'end'`
- `nodeGap`: 声明同一层中两个节点之间的间隙大小
- `nodeWidth`: 声明每个节点的宽度，支持三种取值:

1. 百分比字符串，例如 `{ nodeWidth: '12%' }`
2. 以'px'为单位的简单数字，例如 `{ nodeWidth: 20 }`
3. function，通过自定义计算指定 nodeWidth

- `minNodeHeight` 属性声明数据不为零或空时节点的最小大小，这个配置可以用来避免数据太小时看不到太细的节点，建议小于 5px

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

### 桑基图标签

在桑基图中，标签的位置可以通过`sankeyChart.label.position: 'outside' | 'inside-start' | 'inside-middle' | 'inside-end' | 'left' | 'right'`进行配置。

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

### 桑基图交互

通常情况下，桑基图的父子关系和层次结构是通过 link 的连接来表示的。但是，当数据集较为复杂且层次极深时，这种方式可能不够明确。因此，在这种情况下，需要通过点击来显示父级与子级的关系，以便用户更好地**了解整体数据流程与路径信息**。

在 VChart 中，我们可以通过`sankeyChart.emphasis`进行交互配置。

- `sankeyChart.emphasis.trigger`: 声明交互触发类型。可以配置为 `trigger?: 'click' | 'hover'` , 点击触发或悬浮触发
- `sankeyChart.emphasis.effect`: 声明交互联动效果。
  桑基图提供 3 种在节点上的交互联动效果：

1. self: 仅高亮当前节点；
2. adjacency: 高亮当前节点上下游节点和关联的边，淡化其它图形元素；
3. related： 高亮与当前节点相关的整条路径上的节点和边，淡化其它图形元素

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
