# 散点图

[\[配置项\]](../../../option/scatterChart)

## 简介

散点图是一种用于表示两个变量之间关系的图形。它通过在平面直角坐标系中绘制一系列点来表示两个变量之间的关系，这些点的坐标分别代表每个变量的值。散点图可以帮助我们直观地观察两个变量之间的关系，例如是否存在线性关系、是否存在某种趋势、是否存在异常点等。

正如上文所说，散点图用点的位置表示两个变量之间的关系，点的大小或颜色可以用来区分类别。而在 VChart 中，可以通过 `scatterChart.sizeField`指定散点的大小，从而以此表示变量的数值大小差异，这种指定散点大小的可视化表达方式也叫气泡图。

### 图表构成

散点图由点图元、坐标轴、提示信息及其他组件构成。  
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda0a.png)

- `scatterChart.type`: 图表类型，散点图的类型为`'scatter'`
- `scatterChart.data`: 图表绘制的数据源
- `scatterChart.xField`: 分类/数值字段，映射图元的 x 坐标
- `scatterChart.yField`: 分类/数值字段，映射图元的 y 坐标
- `scatterChart.sizeField`: 数值字段，映射图元的大小

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `scatterChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/scatterChart#axes)
- `scatterChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/scatterChart#tooltip)
- 更多组件配置见[VChart scatterChart 配置](../../../option/scatterChart)

### 快速上手

```javascript livedemo
const spec = {
  type: 'scatter',
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  point: {
    style: {
      size: 10
    }
  },
  data: [
    {
      name: 'data',
      values: [
        {
          y: 10,
          x: '用户1',
          type: 'A'
        },
        {
          y: 31,
          x: '用户2',
          type: 'B'
        },
        {
          y: 15,
          x: '用户3',
          type: 'C'
        }
      ]
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 关键配置

- `categoryField` 属性声明为分类字段
- `valueField` 属性声明为数值字段

## 散点图特性

### 数据

- 一个`离散`/ `数值` 字段，如: `product`，映射图元 x 坐标
- 一个`离散`/ `数值`字段，如: `sales` ，映射图元 y 坐标

可选：

- 一个`数值`字段，如:`count`，映射图元大小
- 一个`离散` 字段，如: `type`，映射图元形状

一组产品类别和销售额的数据定义如下：

```ts
data: [
  {
    name: 'scatter',
    values: [
      {
        product: 'Data Cable',
        sales: 200,
        count: 20,
        type: 'Digital'
      },
      {
        product: 'Tissue',
        sales: 500,
        count: 100,
        type: 'daily necessities'
      },
      {
        product: 'Bread',
        sales: 400,
        count: 100,
        type: 'Food'
      }
    ]
  }
];
```

### 图元及样式

由于散点图对数据的展现较为灵活，一个点图元即代表一条数据，所以人们通常会在其他视觉通道赋予其更多的数据意义。比如形状、大小等等。

#### 形状

通过`scatterChart.shapeField`和`scatterChart.shape`可以分别指定散点图的形状映射字段和映射的范围。

`scatterChart.shape`的声明方式如下：

```ts
  size: {
    type: 'ordinal', // 映射类型，也可以选'linear'
    range: [10, 30, 50] // 映射范围
  }
```

或者也可以直接通过 callback 的形式指定映射关系，
在`scatterChart.shape`做如下声明：

```ts
shape: () => 'start',
```

```javascript livedemo
const data = [
  {
    values: [
      { x: 936196, size: 83431, y: 1371, type: 'Technology', area: 'Northeast' },
      { x: 1270911, size: 219815, y: 5590, type: 'office supplies', area: 'Zhongnan' },
      { x: 453898, size: 19061, y: 727, type: 'Technology', area: 'Southwest' },
      { x: 919743, size: 148800, y: 1199, type: 'furniture', area: 'North China' },
      { x: 1676224, size: 163453, y: 2517, type: 'furniture', area: 'East China' },
      { x: 1466575, size: 251487, y: 2087, type: 'Technology', area: 'Zhongnan' },
      { x: 824673, size: 86067, y: 3622, type: 'office supplies', area: 'Northeast' },
      { x: 230956, size: 24016, y: 347, type: 'Technology', area: 'Northwest' },
      { x: 1599653, size: 228179, y: 2183, type: 'Technology', area: 'East China' },
      { x: 745813, size: 137265, y: 3020, type: 'office supplies', area: 'North China' },
      { x: 267870, size: 49633, y: 970, type: 'office supplies', area: 'Northwest' },
      { x: 1408628, size: 215585, y: 6341, type: 'office supplies', area: 'East China' },
      { x: 781743, size: 144986, y: 927, type: 'Technology', area: 'North China' },
      { x: 501533, size: 29303, y: 814, type: 'furniture', area: 'Southwest' },
      { x: 920698, size: 72692, y: 1470, type: 'furniture', area: 'Northeast' },
      { x: 316212, size: 24903, y: 468, type: 'furniture', area: 'Northwest' },
      { x: 1399928, size: 199582, y: 2023, type: 'furniture', area: 'Zhongnan' },
      { x: 347692, size: 49272, y: 1858, type: 'office supplies', area: 'Southwest' }
    ]
  }
];

// 图表配置
const spec = {
  type: 'scatter',
  data: data,
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  // shape
  shapeField: 'type',
  shape: {
    type: 'ordinal',
    range: ['star', 'triangleLeft', 'diamond']
  },
  // size
  sizeField: 'size',
  size: {
    type: 'linear',
    range: [5, 25]
  },
  // point
  point: {
    state: {
      hover: {
        scaleX: 1.2,
        scaleY: 1.2
      }
    }
  },
  axes: [
    { orient: 'left', range: { min: 0 }, type: 'linear' },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: [
    {
      visible: true,
      orient: 'left',
      position: 'start',
      title: {
        visible: true,
        style: {
          text: 'title'
        }
      },
      item: {
        visible: true
      }
    }
  ],
  direction: 'horizontal'
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 大小

通过`scatterChart.sizeField`和`scatterChart.size`可以分别指定散点图的形状映射字段和映射的范围。
`scatterChart.size`的声明方式如下：

```ts
  size: {
    type: 'linear', // 映射类型
    range: [10, 30] // 映射范围
  }
```

或者也可以直接通过 callback 的形式指定映射关系，
在`scatterChart.size`做如下声明：

```ts
size: (data) => Math.sqrt(data['size']/10, 2),
```

```javascript livedemo
const data = [
  {
    values: [
      { x: 936196, size: 83431, y: 1371, type: 'Technology', area: 'Northeast' },
      { x: 1270911, size: 219815, y: 5590, type: 'office supplies', area: 'Zhongnan' },
      { x: 453898, size: 19061, y: 727, type: 'Technology', area: 'Southwest' },
      { x: 919743, size: 148800, y: 1199, type: 'furniture', area: 'North China' },
      { x: 1676224, size: 163453, y: 2517, type: 'furniture', area: 'East China' },
      { x: 1466575, size: 251487, y: 2087, type: 'Technology', area: 'Zhongnan' },
      { x: 824673, size: 86067, y: 3622, type: 'office supplies', area: 'Northeast' },
      { x: 230956, size: 24016, y: 347, type: 'Technology', area: 'Northwest' },
      { x: 1599653, size: 228179, y: 2183, type: 'Technology', area: 'East China' },
      { x: 745813, size: 137265, y: 3020, type: 'office supplies', area: 'North China' },
      { x: 267870, size: 49633, y: 970, type: 'office supplies', area: 'Northwest' },
      { x: 1408628, size: 215585, y: 6341, type: 'office supplies', area: 'East China' },
      { x: 781743, size: 144986, y: 927, type: 'Technology', area: 'North China' },
      { x: 501533, size: 29303, y: 814, type: 'furniture', area: 'Southwest' },
      { x: 920698, size: 72692, y: 1470, type: 'furniture', area: 'Northeast' },
      { x: 316212, size: 24903, y: 468, type: 'furniture', area: 'Northwest' },
      { x: 1399928, size: 199582, y: 2023, type: 'furniture', area: 'Zhongnan' },
      { x: 347692, size: 49272, y: 1858, type: 'office supplies', area: 'Southwest' }
    ]
  }
];

// 图表配置
const spec = {
  type: 'scatter',
  data: data,
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  // size
  sizeField: 'size',
  size: {
    type: 'linear',
    range: [10, 30]
  },
  // point
  point: {
    state: {
      hover: {
        scaleX: 1.2,
        scaleY: 1.2
      }
    }
  },
  axes: [
    { orient: 'left', range: { min: 0 }, type: 'linear' },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: [
    {
      visible: true,
      orient: 'left',
      position: 'start',
      title: {
        visible: true,
        style: {
          text: 'title'
        }
      },
      item: {
        visible: true
      }
    }
  ],
  direction: 'horizontal'
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
