# 区间柱状图

[\[配置项\]](../../../option/rangeColumnChart)

## 简介

区间柱状图是柱状图的一种，用于表示一段时间内或者某个固定区间内的数据变化。 它的主要特点是每个柱形图表示的是一个范围，而非单一数据，通常在横轴上表示数据变化的范围，在纵轴上表示此区间的数量。区间柱状图适用于展示随时间变化的数据，例如销售额、库存变化等，也常常用于展示某一时期数据的分布，例如温度数据、工资分布等。

## 图表构成

与柱状图类似，区间柱状图由矩形图元、坐标轴及其他组件构成。
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf07.png)

矩形图元为区间柱状图的基本要素，相关的绘制配置必不可少:

- `rangeColumnChart.type`: 图表类型，柱状体 / 条形图的类型为`'rangeColumn'`
- `rangeColumnChart.data`: 图表绘制的数据源
  当`rangeColumnChart.direction: vertical`时
- `rangeColumnChart.xField`: 分类字段，映射图元的 x 坐标
- `rangeColumnChart.yField`: 数值字段数组，映射图元的下边界和上边界，即表现数据的最小值和最大值
  当`rangeColumnChart.direction: vertical`时
- `rangeColumnChart.xField`: 数值字段数组，映射图元的左边界和右边界，即表现数据的最小值和最大值
- `rangeColumnChart.yField`: 分类字段，映射图元的 y 坐标

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `rangeColumnChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/rangeColumnChart#axes)
- `rangeColumnChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/rangeColumnChart#tooltip)
- 更多组件配置见[VChart rangeColumnChart 配置](../../../option/rangeColumnChart)

### 快速上手

```javascript livedemo
const spec = {
  type: 'rangeColumn',
  data: [
    {
      values: [
        { type: '分类一', min: 76, max: 100 },
        { type: '分类二', min: 56, max: 108 },
        { type: '分类三', min: 38, max: 129 },
        { type: '分类四', min: 58, max: 155 },
        { type: '分类五', min: 45, max: 120 },
        { type: '分类六', min: 23, max: 99 },
        { type: '分类七', min: 18, max: 56 },
        { type: '分类八', min: 18, max: 34 }
      ]
    }
  ],
  xField: 'type',
  yField: ['min', 'max'],
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## 区间柱状图特性

### 数据

- 一个`离散` 字段，如: `x`
- 两个`数值`字段，如: `min` `max`

数据定义如下：

```ts
data: [
  {
    name: 'rangeColumn',
    values: [
      {
        x: 'A',
        min: 5,
        max: 8
      },
      {
        x: 'B',
        min: 5,
        max: 8
      },
      {
        x: 'C',
        min: 5,
        max: 8
      }
    ]
  }
];
```

### 标签位置

区间柱状图总体与柱状图配置类似，但由于每根柱子表示一个数值范围，所以通常需要标签进行信息辅助提示。
在 VChart 中，针对区间柱状图提供四种标签布局类型`rangeColumnChart.label.position: 'middle' | 'start' | 'end' | 'bothEnd'`, 它们分别代表标签置于中间、起点、终点和两端, 默认为`middle`。

```javascript livedemo
const spec = {
  type: 'rangeColumn',
  data: [
    {
      id: 'data0',
      values: [
        { type: '分类一', min: 76, max: 100 },
        { type: '分类二', min: 56, max: 108 },
        { type: '分类三', min: 38, max: 129 },
        { type: '分类四', min: 58, max: 155 },
        { type: '分类五', min: 45, max: 120 },
        { type: '分类六', min: 23, max: 99 },
        { type: '分类七', min: 18, max: 56 },
        { type: '分类八', min: 18, max: 34 }
      ]
    }
  ],
  direction: 'horizontal',
  yField: 'type',
  xField: ['min', 'max'],
  label: {
    visible: true,
    position: 'bothEnd' // 两端
    // position: 'start', // 起点
    // position: 'end', // 终点
    // position: 'middle', // 中间
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
