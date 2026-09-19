# Circle Packing

[\[配置项\]](../../../option/circlePackingChart)

## 简介

Circle Packing 是一种基于圆形的数据可视化图表，它通过使用嵌套的圆形来表示具有层次结构的数据。在这种图表中，较小的圆嵌套在较大的圆中，每个圆形的大小和位置通常反映数据的相对数值和层次关系。圆形的大小和颜色等属性也可以用来提供其他信息。Circle Packing 图表通常用于数据挖掘、生态系统和社交媒体分析等领域中进行可视化分析，但也可以用于其他类型的数据可视化任务。

## 图表构成

Circle Packing 主要由相互嵌套的圆形图元及标签、提示信息等元素或组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf02.png)

相互嵌套的圆形图元为 Circle Packing 的基本要素，相关的绘制配置必不可少:

- `circlePackingChart.type`: 图表类型，Circle Packing 的类型为`'circlePacking'`
- `circlePackingChart.data`: 图表绘制的数据源，在 Circle Packing 中通常为具有层级结构，形式如下:

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

- `circlePackingChart.categoryField`: 分类字段，映射不同图元
- `circlePackingChart.valueField`: 数值字段，映射图元的大小

提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `circlePackingChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/circlePackingChart#tooltip)
- 更多组件配置见[VChart circlePackingChart 配置](../../../option/circlePackingChart)

## 快速上手

```javascript livedemo
const data = [
  {
    name: 'root',
    children: [
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
    ]
  }
];

const spec = {
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  type: 'circlePacking',
  categoryField: 'name',
  valueField: 'value',
  circlePacking: {
    style: {
      fillOpacity: d => (d.isLeaf ? 0.75 : 0.25)
    }
  },
  label: {
    style: {
      fontSize: 10,
      visible: d => {
        return d.depth === 1;
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

### 关键配置

- `categoryField` 属性声明为分类字段
- `valueField` 属性声明为数值字段
- `circlePacking` Circle 图元配置，默认所有图元样式一致，为了展示层级关系，通常需要通过`callback`的形式区分不同层级的图元。
- `label` 标签图元配置，默认每个图元都有标签，叶子节点的图元较小，对应的标签显示时难免会重叠，所以需要手动配置字体大小及显隐性。

## Circle Packing 特性

### 数据

正如前文所提到，Circle Packing 通过层层嵌套的圆形来表达数据的嵌套关系，所以源数据必定为嵌套结构，如:

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

可以通过配置`circlePackingChart.layoutPadding`控制嵌套层之间的边距，支持传入数组，单独控制某一层的内边距。

```javascript livedemo
const data = [
  {
    name: 'root',
    children: [
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
    ]
  }
];

const spec = {
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  type: 'circlePacking',
  categoryField: 'name',
  valueField: 'value',
  circlePacking: {
    style: {
      fillOpacity: d => (d.isLeaf ? 0.75 : 0.25)
    }
  },
  layoutPadding: [0, 10, 10],
  label: {
    style: {
      fontSize: 10,
      visible: d => {
        return d.depth === 1;
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

### 图表交互

#### 下钻

下钻功能是在矩形树图、Circle Packing、旭日图等展示不同层次的下级数据时，能够单击父类别以深入挖掘子类别信息的能力。通过下钻功能，用户可以逐级查看详情，深入探索数据的层级细节，并更好地了解数据之间的关系和差异性，得出更高质量的分析结论。

通过配置`circlePackingChart.drill: true` 和 `circlePackingChart.drillField` 可以分别开启下钻功能和配置下钻依据的字段（下钻字段默认情况会使用自动生成 unique key, 但在使用 API 钻取时需要配置`drillField`）。

```javascript livedemo
const data = [
  {
    name: 'root',
    children: [
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
    ]
  }
];

const spec = {
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  type: 'circlePacking',
  categoryField: 'name',
  valueField: 'value',
  drill: true,
  circlePacking: {
    style: {
      fillOpacity: d => (d.isLeaf ? 0.75 : 0.25)
    }
  },
  layoutPadding: [0, 10, 10],
  label: {
    style: {
      fontSize: 10,
      visible: d => {
        return d.depth === 1;
      }
    }
  },
  title: {
    visible: true,
    text: '请尝试点击节点'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```
