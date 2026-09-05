# 图表组成

本教程将详细介绍 VChart 的图表组成，帮助大家更好地理解 VChart。

## 术语定义

在深入了解图表组成之前，我们需要了解以下术语：

- `series` - 图表主体，也称系列，包含一组图元及其对应的图表逻辑。
- `mark` - 基本图形元素，也称基础图元，如点、线条形等。
- `region` - 空间信息元素，关联一组或多组 series，帮助定位空间。
- `component` - 组件，帮助图表阅读和交互的元素，如图例、坐标轴、提示等。
- `layout` - 布局，管理图表元素的空间分布。
- `chart` - 图表抽象概念，整合、管理数据、图元、组件、布局各种元素的管理者。

## 图表定义

### 逻辑层图表元素

我们将图表的逻辑层元素拆解为以下四个部分：

- series 是图表主体，含一组图元和对应类型的图表逻辑。例如线图中，series 指点和线的集合以及线图所有的逻辑等。
- component 提供辅助能力，帮助图表阅读和交互的组件，比如图例，坐标轴，tooltip，dataZoom 等。
- region 是一个空间信息元素，它可以关联一组或多组 series，帮助 series 进行空间定位，同时 region 还是一个最小组合单元。
- chart 是一个抽象概念，它是对图表的各种元素进行整合、管理布局的管理者，是图表逻辑层的核心上下文。

#### 简单图表

简单图表是由一个 region、一个确定类型的 series、component 和一个管理图表逻辑的 chart 构成。以一个常见的折线图为例，其组成如下

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf00.png" alt="折线图的逻辑层元素组成图示">
</div>

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: 'Stacked line chart'
  },
  stack: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  region: [
    {
      style: {
        stroke: '#1971c2',
        lineWidth: 2
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### 组合图表

我们将组合图定义为由多个 region、多个确定类型的 series、component 和一个管理图表逻辑的 chart 构成，这里的 chart 我们将其封装为 `type: 'common'` 的组合图表。

在组合图中可以定义若干不同类型的子图。每个子图可以独立配置自己的数据和组件，所有子图默认关联在同一个 region。此时各个子图在 region 上是重叠的。我们以常见的柱线双轴图为例来详细介绍组合图表：

1. 首先如果我们需要创建组合图，我们需要声明 `type: 'common'`，表示我们需要创建的图表类型为组合图
2. 在上面我们提到，chart 是整合、管理数据、图元、组件、布局各种元素的管理者，从逻辑层组成上他是由 region + series + layout 组成的，而柱线分别对应 'bar' 和 'line' 这两种系列类型，而默认所有的系列都是关联在同一个 region 的，所以这里我们不需要配置 region
3. 每个系列可以有自己的数据源，也可以直接将数据源配置在 chart 上，series 中通过 `fromDataId` 或者 `fromDataIndex` 来关联，当前的例子我们选择配置在 chart 上

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'barData',
      values: [
        { x: '10:00', y: 40, type: '产品1' },
        { x: '12:00', y: 40, type: '产品1' },
        { x: '14:00', y: 56, type: '产品1' },
        { x: '16:00', y: 40, type: '产品1' },
        { x: '18:00', y: 52, type: '产品1' },
        { x: '20:00', y: 74, type: '产品1' },
        { x: '22:00', y: 95, type: '产品1' }
      ]
    },
    {
      id: 'areaData',
      values: [
        { x: '10:00', y2: 15, type: '产品2' },
        { x: '12:00', y2: 23, type: '产品2' },
        { x: '14:00', y2: 22, type: '产品2' },
        { x: '16:00', y2: 22, type: '产品2' },
        { x: '18:00', y2: 27, type: '产品2' },
        { x: '20:00', y2: 37, type: '产品2' },
        { x: '22:00', y2: 36, type: '产品2' }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      xField: 'x',
      yField: 'y',
      data: {
        fromDataId: 'barData'
      }
    },
    {
      type: 'area',
      xField: 'x',
      yField: 'y2',
      data: {
        fromDataId: 'areaData'
      },
      stack: false // area 默认堆叠
    }
  ],
  axes: [{ orient: 'bottom' }, { orient: 'left' }, { orient: 'right' }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

如前所述，region 是空间信息元素，可以结合布局利用多个不同定位的 region 对画布进行空间划分；同时，组件也可以指定与 region 关联的关系，当一个组件关联了多个 region 时，会默认收集所有 region 下子图的数据维度进行展示，如下示例所示：

```javascript livedemo
const spec = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 4,
    row: 3,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        colSpan: 4,
        row: 0
      },
      {
        modelId: 'pie-region',
        col: 0,
        colSpan: 2,
        row: 1
      },
      {
        modelId: 'axis-left',
        col: 2,
        row: 1
      },
      {
        modelId: 'bar-region',
        col: 3,
        row: 1
      },
      {
        modelId: 'axis-bottom',
        col: 3,
        row: 2
      }
    ]
  },
  region: [
    {
      id: 'pie-region'
    },
    {
      id: 'bar-region'
    }
  ],
  legends: {
    visible: true,
    orient: 'top',
    id: 'legend',
    regionId: ['pie-region', 'bar-region']
  },
  series: [
    {
      regionId: 'pie-region',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'pie',
        values: [
          { type: 'a', value: 10 },
          { type: 'b', value: 20 }
        ]
      },
      seriesField: 'type'
    },
    {
      regionId: 'bar-region',
      type: 'bar',
      xField: ['x', 'type'],
      yField: 'y',
      data: {
        id: 'bar',
        values: [
          { x: '1', y: 10, type: 'a' },
          { x: '1', y: 20, type: 'b' },
          { x: '2', y: 30, type: 'a' },
          { x: '2', y: 40, type: 'b' }
        ]
      },
      seriesField: 'type'
    }
  ],
  axes: [
    {
      id: 'axis-left',
      regionId: 'bar-region',
      orient: 'left'
    },
    {
      id: 'axis-bottom',
      regionId: 'bar-region',
      orient: 'bottom'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 视图层图元素

#### 图元 mark

图元是图表视图层对图形的定义，VChart 定义图表中的图元包括基础图元和组合图元。

基础图元包括：标记（symbol）、矩形（rect）、线条（line）、直线（rule）、弧形（arc）、面积（area）、文本（text）、路径（path）、图片（image）、3D 矩形（rect3d）、3D 弧线（arc3d）、多边形（polygon）等。

由多个基础图元进行组合就构成了组合图元，我们把基础图元和组合图元统称为图元。

逻辑层元素（如 series 系列）是由若干图元构成的，如面积图（`'area'`）系列，包括点、线、面积组成，对应的基础图元分别为：标记（Symbol）、线条（line）、面积（area）

图元的功能包括：

- 灵活的图元样式配置，包括基础样式和交互样式。
- 支持自定义图元，实现更丰富的定制化图表需求，见[自定义图元](../extend/custom_mark)章节。
