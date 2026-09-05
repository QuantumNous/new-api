# 布局策略

VChart 的内置布局策略分为 2 种，一种是基于占位的布局，一种是基于 grid 的布局。除此之外 VChart 还支持自定义布局。这里将详细介绍内置布局策略的使用。

## 图表的布局元素

在介绍布局策略之前，先介绍图表的布局元素，在不同的布局策略种，图表的布局元素是一样的。图表的布局元素主要有以下几种：

- region 也就是系列的容器，可以理解为图表的一个区域，一个图表可以有多个 region，每个 region 可以有一个或多个系列。
- component 也就是组件，一个图表可以有多个组件。比如轴，图例，标题等等。

因为系列的容器 region 已经参与布局，所以系列本身不再参与布局，只需要指定系列在哪一个 region 中。

如下图所示：

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf00.png" alt="图表的元素组成图示">
</div>

## 基于占位的布局

占位的布局中，图表布局元素被分为几种不同的类型

- normal 普通布局元素，比如标题，图例，会在最开始按照顺序进行占位布局。
- region-relative 与 region 元素位置有绑定关系的元素。会在布局开始时计算一次大小，进行位置估算，之后按照先水平，后垂直的顺序进行二次布局
- region 系列容器，在 region-relative 元素布局完成后，会根据剩余空间大小，对 region 元素布局。
- absolute 元素，忽略其他元素的位置，以图表画布原点为基础，按照布局配置进行位置布局。

整个布局流程如下图所示：

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda0c.gif" alt="布局过程示意图">
</div>

## 基于 grid 的布局

为了满足常见的单列，单行，等类简单表格的布局场景。我们提供了一个 grid 布局，在这种布局模式下， 除了 `absolute` 元素外，其他元素统一作为布局的基础元素，需要在布局配置中，为这些布局模块指定布局信息。

- modelId 布局模块的 id 。
- col 元素在第几列。从左向右，从 0 开始计数。
- row 元素在第几行。从上向下，从 0 开始计数。
- colSpan 列方向，当前元素占几列，默认值为 1。
- rowSpan 行方向，当前元素占几行，默认值为 1。

> 注意，所有的布局元素此时都将独立的座位布局元素处理，轴，与 region 不在有位置上的关联关系，需要各自独立配置

布局效果如下图示意：

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf08.png" alt="Grid 布局示意">
</div>

在上图中，总计 2 列，4 行。各元素的位置信息如下

- legend 图例布局位置起点 `(0,0)` ，占 `1` 行， `2` 列。
- pie-region 饼图 `region`，布局位置起点 `(1,0)` ，占 `1` 行， `2` 列。
- axis-left 左轴，布局位置起点 `(2,0)` ，占 `1` 行， `1` 列。
- line-region 线图 `region`，布局位置起点 `(2,1)` ，占 `1` 行， `1` 列。
- axis-bottom 右轴，布局位置起点 `(3,1)`，占 `1` 行， `1` 列。

图表示例如下：

```javascript livedemo
const spec = {
  type: 'common',
  padding: {
    top: 10
  },
  layout: {
    type: 'grid',
    col: 2,
    row: 4,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        colSpan: 2,
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
        col: 0,
        row: 2
      },
      {
        modelId: 'line-region',
        col: 1,
        row: 2
      },
      {
        modelId: 'axis-bottom',
        col: 1,
        row: 3
      }
    ]
  },
  region: [
    {
      id: 'pie-region',
      height: '40%'
    },
    {
      id: 'line-region'
    }
  ],
  legends: {
    visible: true,
    orient: 'top',
    id: 'legend',
    regionId: ['pie-region', 'line-region']
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
      regionId: 'line-region',
      type: 'line',
      xField: 'x',
      yField: 'y',
      data: {
        id: 'line',
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
      regionId: 'line-region',
      orient: 'left'
    },

    {
      id: 'axis-bottom',
      regionId: 'line-region',
      orient: 'bottom'
    }
  ],
  tooltip: {
    dimension: {
      visible: true
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
window['vchart'] = vchart;
```
