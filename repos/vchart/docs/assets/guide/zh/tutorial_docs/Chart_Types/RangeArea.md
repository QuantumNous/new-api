# 区间面积图

[\[配置项\]](../../../option/rangeAreaChart)

## 简介

区间面积图 (Range Area Chart) 是一种用于展示不同数据集间的区间差异的视觉编码图形。在区间面积图中，您可以清楚地看到每个数据集之间的最小值字段和最大值字段的变化，以及它们之间的差距。这种图表常常用于展示数据的波动范围、不确定性、以及趋势。在 VChart 中，您可以轻松地配置和生成这样的图表。

## 图表构成

与面积图类似，区间面积图由面积图元、坐标轴及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a06.png)

矩形图元为区间面积图的基本要素，相关的绘制配置必不可少:

- `rangeAreaChart.type`: 图表类型，柱状体 / 条形图的类型为`'rangeArea'`
- `rangeAreaChart.data`: 图表绘制的数据源
- `rangeAreaChart.xField`: 分类字段，映射图元的 x 坐标
- `rangeAreaChart.yField`: 数值字段数组，映射图元的下边界和上边界，即表现数据的最小值和最大值

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `rangeAreaChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/rangeAreaChart#axes)
- `rangeAreaChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/rangeAreaChart#tooltip)
- 更多组件配置见[VChart rangeAreaChart 配置](../../../option/rangeAreaChart)

## 快速上手

```javascript livedemo
const spec = {
  type: 'rangeArea',
  data: [
    {
      id: 'areaData',
      values: [
        { type: 'Category One', min: 76, max: 100 },
        { type: 'Category Two', min: 56, max: 108 },
        { type: 'Category Three', min: 38, max: 129 },
        { type: 'Category Four', min: 58, max: 155 },
        { type: 'Category Five', min: 45, max: 120 },
        { type: 'Category Six', min: 23, max: 99 },
        { type: 'Category Seven', min: 18, max: 56 },
        { type: 'Category Eight', min: 18, max: 34 }
      ]
    }
  ],
  type: 'rangeArea',
  dataIndex: 0,
  xField: 'type',
  yField: ['min', 'max'],
  stack: false,
  area: {
    style: {
      fillOpacity: 0.15
    }
  },
  axes: [
    {
      orient: 'left',
      label: {
        visible: true
      },
      type: 'linear'
    },
    { orient: 'bottom', type: 'band' }
  ],
  crosshair: {
    xField: { visible: true }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 关键配置

- `yField` 属性配置为最小值数值属性与最大值数值属性共同构成的数组

## 区间面积图特性

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

### 区间面积折线组合图

由于区间面积图只能展示每个维度下数据的最大最小值，为了展示数据整体走势，通常会将区间面积图和折线图进行组合。

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'areaData',
      values: [
        { type: 'Category One', min: 76, max: 100 },
        { type: 'Category Two', min: 56, max: 108 },
        { type: 'Category Three', min: 38, max: 129 },
        { type: 'Category Four', min: 58, max: 155 },
        { type: 'Category Five', min: 45, max: 120 },
        { type: 'Category Six', min: 23, max: 99 },
        { type: 'Category Seven', min: 18, max: 56 },
        { type: 'Category Eight', min: 18, max: 34 }
      ]
    },
    {
      id: 'lineData',
      values: [
        { type: 'Category One', average: 88 },
        { type: 'Category Two', average: 82 },
        { type: 'Category Three', average: 83.5 },
        { type: 'Category Four', average: 106.5 },
        { type: 'Category Five', average: 82.5 },
        { type: 'Category Six', average: 61 },
        { type: 'Category Seven', average: 37 },
        { type: 'Category Eight', average: 26 }
      ]
    }
  ],
  series: [
    {
      type: 'rangeArea',
      dataIndex: 0,
      xField: 'type',
      yField: ['min', 'max'],
      stack: false,
      area: {
        style: {
          fillOpacity: 0.15
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      xField: 'type',
      yField: 'average',
      point: {
        state: {
          hover: {
            fillOpacity: 0.5,
            stroke: 'blue',
            lineWidth: 2
          },
          selected: {
            fill: 'red'
          }
        }
      }
    }
  ],

  axes: [
    {
      orient: 'left',
      label: {
        visible: true
      },
      type: 'linear'
    },
    { orient: 'bottom', type: 'band' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
