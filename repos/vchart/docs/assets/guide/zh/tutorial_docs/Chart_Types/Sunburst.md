# 旭日图

[\[配置项\]](../../../option/sunburstChart)

## 简介

旭日图是一种基于饼图的可视化图表，通过展示一个圆形中嵌套的分层结构，反映数据的层级结构和 group 成关系。

在旭日图中，圆形的每个扇形代表一级分类，而扇形内的较小扇形表示此分类下的子分类，以此类推。这种嵌套以通常以递归方式直到达到分类树的叶子节点。数据可以通过扇区的大小和颜色来编码，使得使用者可以在一个整体的视角下，快速了解复杂数据的 group 织结构、相对比例和 group 成部分之间的关系。

## 图表构成

旭日图主要由具有层级结构的扇形图元及标签、提示信息等元素或 group 件构成。
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda09.png)

具有层级结构的扇形图元为旭日图的基本要素，相关的绘制配置必不可少:

- `sunburstChart.type`: 图表类型，旭日图的类型为`'circlePacking'`
- `sunburstChart.data`: 图表绘制的数据源，在旭日图中通常为具有层级结构，形式如下:

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

- `sunburstChart.categoryField`: 分类字段，映射不同图元
- `sunburstChart.valueField`: 数值字段，映射图元的角度范围

提示信息等作为辅助图表展示的 group 件，属于可选配置，自带默认效果和功能:

- `sunburstChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息 group 件配置](../../../option/sunburstChart#tooltip)
- 更多 group 件配置见[VChart sunburstChart 配置](../../../option/sunburstChart)

## 快速上手

```javascript livedemo
const data = [
  {
    name: 'Country A',
    children: [
      {
        name: 'Region1',
        children: [
          { name: 'Office Supplies', value: 824 },
          { name: 'Furniture', value: 920 },
          { name: 'Electronic equipment', value: 936 }
        ]
      },
      {
        name: 'Region2',
        children: [
          { name: 'Office Supplies', value: 1270 },
          { name: 'Furniture', value: 1399 },
          { name: 'Electronic equipment', value: 1466 }
        ]
      },
      {
        name: 'Region3',
        children: [
          { name: 'Office Supplies', value: 1408 },
          { name: 'Furniture', value: 1676 },
          { name: 'Electronic equipment', value: 1559 }
        ]
      },
      {
        name: 'Region4',
        children: [
          { name: 'Office Supplies', value: 745 },
          { name: 'Furniture', value: 919 },
          { name: 'Electronic equipment', value: 781 }
        ]
      },
      {
        name: 'Region5',
        children: [
          { name: 'Office Supplies', value: 267 },
          { name: 'Furniture', value: 316 },
          { name: 'Electronic equipment', value: 230 }
        ]
      },
      {
        name: 'Region6',
        children: [
          { name: 'Office Supplies', value: 347 },
          { name: 'Furniture', value: 501 },
          { name: 'Electronic equipment', value: 453 }
        ]
      }
    ]
  },
  {
    name: 'Country B',
    children: [
      {
        name: 'Region1',
        children: [
          { name: 'Office Supplies', value: 824 },
          { name: 'Furniture', value: 920 },
          { name: 'Electronic equipment', value: 936 }
        ]
      },
      {
        name: 'Region2',
        children: [
          { name: 'Office Supplies', value: 1270 },
          { name: 'Furniture', value: 1399 },
          { name: 'Electronic equipment', value: 1466 }
        ]
      },
      {
        name: 'Region3',
        children: [
          { name: 'Office Supplies', value: 1408 },
          { name: 'Furniture', value: 1676 },
          { name: 'Electronic equipment', value: 1559 }
        ]
      },
      {
        name: 'Region4',
        children: [
          { name: 'Office Supplies', value: 745 },
          { name: 'Furniture', value: 919 },
          { name: 'Electronic equipment', value: 781 }
        ]
      },
      {
        name: 'Region5',
        children: [
          { name: 'Office Supplies', value: 267 },
          { name: 'Furniture', value: 316 },
          { name: 'Electronic equipment', value: 230 }
        ]
      },
      {
        name: 'Region6',
        children: [
          { name: 'Office Supplies', value: 347 },
          { name: 'Furniture', value: 501 },
          { name: 'Electronic equipment', value: 453 }
        ]
      }
    ]
  },
  {
    name: 'Country C',
    children: [
      {
        name: 'Region1',
        children: [
          { name: 'Office Supplies', value: 824 },
          { name: 'Furniture', value: 920 },
          { name: 'Electronic equipment', value: 936 }
        ]
      },
      {
        name: 'Region2',
        children: [
          { name: 'Office Supplies', value: 1270 },
          { name: 'Furniture', value: 1399 },
          { name: 'Electronic equipment', value: 1466 }
        ]
      },
      {
        name: 'Region3',
        children: [
          { name: 'Office Supplies', value: 1408 },
          { name: 'Furniture', value: 1676 },
          { name: 'Electronic equipment', value: 1559 }
        ]
      },
      {
        name: 'Region4',
        children: [
          { name: 'Office Supplies', value: 745 },
          { name: 'Furniture', value: 919 },
          { name: 'Electronic equipment', value: 781 }
        ]
      },
      {
        name: 'Region5',
        children: [
          { name: 'Office Supplies', value: 267 },
          { name: 'Furniture', value: 316 },
          { name: 'Electronic equipment', value: 230 }
        ]
      },
      {
        name: 'Region6',
        children: [
          { name: 'Office Supplies', value: 347 },
          { name: 'Furniture', value: 501 },
          { name: 'Electronic equipment', value: 453 }
        ]
      }
    ]
  }
];

const spec = {
  type: 'sunburst',
  categoryField: 'name',
  valueField: 'value',
  sunburst: {
    visible: true,
    style: {
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  label: {
    visible: true,
    style: {
      fontSize: 12,
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  data: [
    {
      id: 'data',
      values: data
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

- `categoryField` 属性声明为分类字段
- `valueField` 属性声明为数值字段
- `sunburst` sunburst 图元配置，默认所有图元样式一致，为了展示层级关系，通常需要通过`callback`的形式区分不同层级的图元。
- `label` 标签图元配置，默认每个图元都有标签并且样式一致，为了展示层级关系，通常需要通过`callback`的形式区分不同层级的标签。

## 旭日图特性

### 数据

正如前文所提到，旭日图通过层层嵌套的环形来表达数据的嵌套关系，所以源数据必定为嵌套结构，如:

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

### 图表布局

#### 位置

通过`sunburstChart.centerX`、`sunburstChart.centerY`、`sunburstChart.offsetX`、`sunburstChart.offsetY`可以分别配置旭日图中心点 x、y 坐标和对应偏移量。

```javascript livedemo
const data = [
  {
    name: 'Country A',
    children: [
      {
        name: 'Region1',
        children: [
          { name: 'Office Supplies', value: 824 },
          { name: 'Furniture', value: 920 },
          { name: 'Electronic equipment', value: 936 }
        ]
      },
      {
        name: 'Region2',
        children: [
          { name: 'Office Supplies', value: 1270 },
          { name: 'Furniture', value: 1399 },
          { name: 'Electronic equipment', value: 1466 }
        ]
      },
      {
        name: 'Region3',
        children: [
          { name: 'Office Supplies', value: 1408 },
          { name: 'Furniture', value: 1676 },
          { name: 'Electronic equipment', value: 1559 }
        ]
      },
      {
        name: 'Region4',
        children: [
          { name: 'Office Supplies', value: 745 },
          { name: 'Furniture', value: 919 },
          { name: 'Electronic equipment', value: 781 }
        ]
      },
      {
        name: 'Region5',
        children: [
          { name: 'Office Supplies', value: 267 },
          { name: 'Furniture', value: 316 },
          { name: 'Electronic equipment', value: 230 }
        ]
      },
      {
        name: 'Region6',
        children: [
          { name: 'Office Supplies', value: 347 },
          { name: 'Furniture', value: 501 },
          { name: 'Electronic equipment', value: 453 }
        ]
      }
    ]
  },
  {
    name: 'Country B',
    children: [
      {
        name: 'Region1',
        children: [
          { name: 'Office Supplies', value: 824 },
          { name: 'Furniture', value: 920 },
          { name: 'Electronic equipment', value: 936 }
        ]
      },
      {
        name: 'Region2',
        children: [
          { name: 'Office Supplies', value: 1270 },
          { name: 'Furniture', value: 1399 },
          { name: 'Electronic equipment', value: 1466 }
        ]
      },
      {
        name: 'Region3',
        children: [
          { name: 'Office Supplies', value: 1408 },
          { name: 'Furniture', value: 1676 },
          { name: 'Electronic equipment', value: 1559 }
        ]
      },
      {
        name: 'Region4',
        children: [
          { name: 'Office Supplies', value: 745 },
          { name: 'Furniture', value: 919 },
          { name: 'Electronic equipment', value: 781 }
        ]
      },
      {
        name: 'Region5',
        children: [
          { name: 'Office Supplies', value: 267 },
          { name: 'Furniture', value: 316 },
          { name: 'Electronic equipment', value: 230 }
        ]
      },
      {
        name: 'Region6',
        children: [
          { name: 'Office Supplies', value: 347 },
          { name: 'Furniture', value: 501 },
          { name: 'Electronic equipment', value: 453 }
        ]
      }
    ]
  },
  {
    name: 'Country C',
    children: [
      {
        name: 'Region1',
        children: [
          { name: 'Office Supplies', value: 824 },
          { name: 'Furniture', value: 920 },
          { name: 'Electronic equipment', value: 936 }
        ]
      },
      {
        name: 'Region2',
        children: [
          { name: 'Office Supplies', value: 1270 },
          { name: 'Furniture', value: 1399 },
          { name: 'Electronic equipment', value: 1466 }
        ]
      },
      {
        name: 'Region3',
        children: [
          { name: 'Office Supplies', value: 1408 },
          { name: 'Furniture', value: 1676 },
          { name: 'Electronic equipment', value: 1559 }
        ]
      },
      {
        name: 'Region4',
        children: [
          { name: 'Office Supplies', value: 745 },
          { name: 'Furniture', value: 919 },
          { name: 'Electronic equipment', value: 781 }
        ]
      },
      {
        name: 'Region5',
        children: [
          { name: 'Office Supplies', value: 267 },
          { name: 'Furniture', value: 316 },
          { name: 'Electronic equipment', value: 230 }
        ]
      },
      {
        name: 'Region6',
        children: [
          { name: 'Office Supplies', value: 347 },
          { name: 'Furniture', value: 501 },
          { name: 'Electronic equipment', value: 453 }
        ]
      }
    ]
  }
];

const spec = {
  type: 'sunburst',
  categoryField: 'name',
  valueField: 'value',
  centerX: 10,
  centerY: 20,
  offsetX: 10,
  offsetY: 20,
  sunburst: {
    visible: true,
    style: {
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  label: {
    visible: true,
    style: {
      fontSize: 12,
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  data: [
    {
      id: 'data',
      values: data
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### 角度范围

通过`sunburstChart.startAngle`和`sunburstChart.endAngle`可以配置旭日图的角度范围。

```javascript livedemo
const data = [
  {
    name: 'companyA',
    children: [
      {
        name: 'departmentA',
        children: [
          {
            name: 'group1',
            value: 1
          },
          {
            name: 'group2',
            value: 2
          }
        ]
      },
      {
        name: 'departmentB',
        children: [
          {
            name: 'group3',
            children: [
              {
                name: 'staff1',
                value: 2
              },
              {
                name: 'staff2',
                value: 1
              }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'companyB',
    children: [
      {
        name: 'departmentC',
        children: [
          {
            name: 'group4',
            value: 4
          },
          {
            name: 'group5',
            value: 5
          }
        ]
      },
      {
        name: 'departmentD',
        children: [
          {
            name: 'group6',
            value: 6
          }
        ]
      }
    ]
  },
  {
    name: 'companyC',
    children: [
      {
        name: 'departmentE',
        children: [
          {
            name: 'group7',
            value: 7
          },
          {
            name: 'group8',
            value: 8
          }
        ]
      },
      {
        name: 'departmentF',
        children: [
          {
            name: 'group9',
            value: 9
          }
        ]
      }
    ]
  },
  {
    name: 'companyD',
    children: [
      {
        name: 'departmentG',
        value: 10
      },
      {
        name: 'departmentH',
        value: 5
      }
    ]
  }
];
const spec = {
  type: 'sunburst',
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  endAngle: 180,
  labelAutoVisible: {
    enable: true,
    circumference: 5
  },
  gap: [5, 10],
  sunburst: {
    style: {
      visible: true,
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### 内外半径

通过`sunburstChart.innerRadius`和`sunburstChart.outerRadius`可以配置旭日图的内外半径，支持传入数 group，逐层配置。

```javascript livedemo
const data = [
  {
    name: 'Country A',
    children: [
      {
        name: 'Region1',
        children: [
          { name: 'Office Supplies', value: 824 },
          { name: 'Furniture', value: 920 },
          { name: 'Electronic equipment', value: 936 }
        ]
      },
      {
        name: 'Region2',
        children: [
          { name: 'Office Supplies', value: 1270 },
          { name: 'Furniture', value: 1399 },
          { name: 'Electronic equipment', value: 1466 }
        ]
      },
      {
        name: 'Region3',
        children: [
          { name: 'Office Supplies', value: 1408 },
          { name: 'Furniture', value: 1676 },
          { name: 'Electronic equipment', value: 1559 }
        ]
      },
      {
        name: 'Region4',
        children: [
          { name: 'Office Supplies', value: 745 },
          { name: 'Furniture', value: 919 },
          { name: 'Electronic equipment', value: 781 }
        ]
      },
      {
        name: 'Region5',
        children: [
          { name: 'Office Supplies', value: 267 },
          { name: 'Furniture', value: 316 },
          { name: 'Electronic equipment', value: 230 }
        ]
      },
      {
        name: 'Region6',
        children: [
          { name: 'Office Supplies', value: 347 },
          { name: 'Furniture', value: 501 },
          { name: 'Electronic equipment', value: 453 }
        ]
      }
    ]
  },
  {
    name: 'Country B',
    children: [
      {
        name: 'Region1',
        children: [
          { name: 'Office Supplies', value: 824 },
          { name: 'Furniture', value: 920 },
          { name: 'Electronic equipment', value: 936 }
        ]
      },
      {
        name: 'Region2',
        children: [
          { name: 'Office Supplies', value: 1270 },
          { name: 'Furniture', value: 1399 },
          { name: 'Electronic equipment', value: 1466 }
        ]
      },
      {
        name: 'Region3',
        children: [
          { name: 'Office Supplies', value: 1408 },
          { name: 'Furniture', value: 1676 },
          { name: 'Electronic equipment', value: 1559 }
        ]
      },
      {
        name: 'Region4',
        children: [
          { name: 'Office Supplies', value: 745 },
          { name: 'Furniture', value: 919 },
          { name: 'Electronic equipment', value: 781 }
        ]
      },
      {
        name: 'Region5',
        children: [
          { name: 'Office Supplies', value: 267 },
          { name: 'Furniture', value: 316 },
          { name: 'Electronic equipment', value: 230 }
        ]
      },
      {
        name: 'Region6',
        children: [
          { name: 'Office Supplies', value: 347 },
          { name: 'Furniture', value: 501 },
          { name: 'Electronic equipment', value: 453 }
        ]
      }
    ]
  },
  {
    name: 'Country C',
    children: [
      {
        name: 'Region1',
        children: [
          { name: 'Office Supplies', value: 824 },
          { name: 'Furniture', value: 920 },
          { name: 'Electronic equipment', value: 936 }
        ]
      },
      {
        name: 'Region2',
        children: [
          { name: 'Office Supplies', value: 1270 },
          { name: 'Furniture', value: 1399 },
          { name: 'Electronic equipment', value: 1466 }
        ]
      },
      {
        name: 'Region3',
        children: [
          { name: 'Office Supplies', value: 1408 },
          { name: 'Furniture', value: 1676 },
          { name: 'Electronic equipment', value: 1559 }
        ]
      },
      {
        name: 'Region4',
        children: [
          { name: 'Office Supplies', value: 745 },
          { name: 'Furniture', value: 919 },
          { name: 'Electronic equipment', value: 781 }
        ]
      },
      {
        name: 'Region5',
        children: [
          { name: 'Office Supplies', value: 267 },
          { name: 'Furniture', value: 316 },
          { name: 'Electronic equipment', value: 230 }
        ]
      },
      {
        name: 'Region6',
        children: [
          { name: 'Office Supplies', value: 347 },
          { name: 'Furniture', value: 501 },
          { name: 'Electronic equipment', value: 453 }
        ]
      }
    ]
  }
];

const spec = {
  type: 'sunburst',
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  offsetX: 0,
  offsetY: 0,
  categoryField: 'name',
  valueField: 'value',
  innerRadius: [0, 0.4, 0.8],
  outerRadius: [0.3, 0.7, 0.85],
  gap: 0,
  drill: true,
  labelAutoVisible: {
    enable: true,
    circumference: 1
  },
  labelLayout: [
    {
      align: 'center',
      rotate: 'tangential',
      offset: 0
    },
    null,
    {
      align: 'start',
      rotate: 'radial',
      offset: 15
    }
  ],
  sunburst: {
    visible: true,
    style: {
      fillOpacity: datum => {
        return datum.isLeaf ? 0.4 : 0.8;
      }
    }
  },
  label: {
    visible: true
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### 层级间隔

通过`sunburstChart.gap`可以配置层级间隔，支持传入数 group，逐层配置层级间隔。

#### 标签布局

todo: 一个表格

### 图表交互

#### 下钻

下钻功能是在矩形树图、Circle Packing、旭日图等展示不同层次的下级数据时，能够单击父类别以深入挖掘子类别信息的能力。通过下钻功能，用户可以逐级查看详情，深入探索数据的层级细节，并更好地了解数据之间的关系和差异性，得出更高质量的分析结论。

通过配置`sunburstChart.drill: true` 和 `sunburstChart.drillField` 可以分别开启下钻功能和配置下钻依据的字段（下钻字段默认情况会使用自动生成 unique key, 但在使用 API 钻取时需要配置`drillField`）。
