# 瀑布图

[\[配置项\]](../../../option/waterfallChart)

## 简介

瀑布图以柱状形式表示数值的累计过程，常用于分析和解释各项数据变化累计影响的结果，例如收入或支出的来源和变化因素。

## 图表构成

瀑布图由柱状图元、引导线图元、坐标轴及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf06.png)

矩形图元为瀑布图的基本要素，相关的绘制配置必不可少:

- `waterfallChart.type`: 图表类型，瀑布图的类型为`'waterfall'`
- `waterfallChart.data`: 图表绘制的数据源
- `waterfallChart.xField`: 分类字段，映射矩形图元的 x 坐标或宽度
- `waterfallChart.yField`: 数值字段，映射矩形图元的高度或 y 坐标
- `waterfallChart.total`: 用于配置图表计算的**总计数据对应的矩形图元**，详细配置见[waterfallChart.total](../../../option/waterfallChart#total)

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能：

- `waterfallChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详细配置见[VChart 坐标轴组件配置](../../../option/waterfallChart#axes)
- `waterfallChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/waterfallChart#tooltip)
- 更多组件配置见[VChart waterfallChart 配置](../../../option/waterfallChart)

## 快速上手

```javascript livedemo
const spec = {
  type: 'waterfall',
  data: {
    id: 'id0',
    values: [
      { x: 'Feb.11', y: 5 },
      { x: 'Feb.20', y: 2 },
      { x: 'Feb.25', y: -2 },
      { x: 'Mar.4', y: 2 },
      { x: 'Mar.11', y: 2 },
      { x: 'Mar.19', y: 5 },
      { x: 'Mar.26', y: 1 },
      { x: 'Apr.1', y: 1 },
      { x: 'Apr.8', y: 1 },
      { x: 'Apr.15', y: 2 },
      { x: 'Apr.22', y: 1 },
      { x: 'Apr.29', y: -2 },
      { x: 'May.6', y: -1 }
    ]
  },
  legends: { visible: true, orient: 'bottom' },
  xField: 'x',
  yField: 'y',
  axes: [
    {
      orient: 'left',
      title: { visible: true, text: 'favorability' },
      label: {
        formatMethod: v => {
          return v + '%';
        }
      }
    },
    {
      orient: 'bottom',
      label: { visible: true },
      type: 'band',
      paddingInner: 0.4,
      title: { visible: true, text: 'date' }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## 瀑布图特性

### 数据

- 一个`离散` 字段，如: `product`
- 一个`数值`字段，如: `sales`

一组产品类别和销售额的数据定义如下：

```ts
data: [
  {
    name: 'bar',
    values: [
      {
        product: '数码产品',
        sales: 20
      },
      {
        product: '日用品',
        sales: 50
      },
      {
        product: '食品',
        sales: 80
      }
    ]
  }
];
```

### 数据与布局

瀑布图是一种显示数值流动或累积变化的图表，在 VChart 中提供三种累积值的绘制方式:

- 在末尾增加总计信息，并绘制总计图元
- 指定某个字段为总计信息，并将其视作总计图元
- 自定义总计

#### 在末尾增加总计信息，并绘制总计图元

通过`waterfallChart.total.type: 'end'`可以在末尾追加统计信息。
具体配置如下:

- `waterfallChart.total.type: 'end'` 声明统计方式
- `waterfallChart.total.text`声明统计文本

```javascript livedemo
const spec = {
  type: 'waterfall',
  data: {
    id: 'id0',
    values: [
      { x: 'Feb.11', y: 5 },
      { x: 'Feb.20', y: 2 },
      { x: 'Feb.25', y: -2 },
      { x: 'Mar.4', y: 2 },
      { x: 'Mar.11', y: 2 },
      { x: 'Mar.19', y: 5 },
      { x: 'Mar.26', y: 1 },
      { x: 'Apr.1', y: 1 },
      { x: 'Apr.8', y: 1 },
      { x: 'Apr.15', y: 2 },
      { x: 'Apr.22', y: 1 },
      { x: 'Apr.29', y: -2 },
      { x: 'May.6', y: -1 }
    ]
  },
  legends: { visible: true, orient: 'bottom' },
  xField: 'x',
  yField: 'y',
  stackLabel: {
    valueType: 'absolute',
    formatMethod: text => {
      return text + '%';
    }
  },
  total: {
    type: 'end',
    text: '总计'
  },
  axes: [
    {
      orient: 'left',
      title: { visible: true, text: 'favorability' },
      label: {
        formatMethod: v => {
          return v + '%';
        }
      }
    },
    {
      orient: 'bottom',
      label: { visible: true },
      type: 'band',
      paddingInner: 0.4,
      title: { visible: true, text: 'date' }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 指定某个字段为总计信息，并将其视作总计图元

通过`waterfallChart.total.type: 'field'`可以指定某个字段为总计信息，并将其视作总计图元。
具体配置如下:

- `waterfallChart.total.type: 'field'` 声明统计方式
- `waterfallChart.total.tagField`声明总计值的标志位，对应`field`的值为`true`时，认为**这条数据是总计数据**
- `waterfallChart.total.valueField`可以指定总计值
- `waterfallChart.total.startField`可以指定总计起点
- `waterfallChart.total.collectCountField`可以指定总计计算前`n`个维度的字段，比如该字段指定为`'collect'`，那么**在被识别为总计的那条数据中`'collect'`字段读到的就这个`n`**。

```javascript livedemo
const spec = {
  type: 'waterfall',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'First quarter-primary industry', y: 10954, type: 'primary industry' },
        { x: 'First Quarter-Secondary Industry', y: 106187, type: 'Secondary Industry' },
        { x: 'First quarter-tertiary industry', y: 153037, type: 'tertiary industry' },
        { x: 'First quarter', total: true, collect: 3 },
        { x: 'Second Quarter-Primary Industry', y: 18183, type: 'Primary Industry' },
        { x: 'Second Quarter-Second Industry', y: 122450, type: 'Second Industry' },
        { x: 'Second Quarter-Tertiary Industry', y: 151831, type: 'Tertiary Industry' },
        { x: 'Second quarter', total: true, collect: 3 },
        { x: 'Third Quarter-Primary Industry', y: 25642, type: 'Primary Industry' },
        { x: 'Third Quarter-Second Industry', y: 121553, type: 'Second Industry' },
        { x: 'Third quarter-tertiary industry', y: 160432, type: 'tertiary industry' },
        { x: 'Third Quarter', total: true, collect: 3 },
        { x: 'Fourth Quarter-Primary Industry', y: 33497, type: 'Primary Industry' },
        { x: 'Fourth Quarter-Secondary Industry', y: 132601, type: 'Secondary Industry' },
        { x: 'Fourth quarter-tertiary industry', y: 169411, type: 'tertiary industry' },
        { x: 'four quarters', total: true, collect: 3 },
        { x: 'full year', total: true }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  total: {
    type: 'field',
    tagField: 'total',
    startField: 'start',
    valueField: 'value',
    collectCountField: 'collect'
  },
  stackLabel: {
    valueType: 'change',
    formatMethod: text => {
      return parseInt(text / 10000, 10) + 'w';
    }
  },
  title: {
    visible: true,
    text: 'Chinese quarterly GDP in 2022'
  },
  legends: { visible: true, orient: 'bottom' },
  axes: [
    { orient: 'left', title: { visible: true, text: 'unit: 100 million yuan' } },
    {
      orient: 'bottom',
      label: {
        visible: true,
        formatMethod: text => {
          const arr = text.split('-');
          return arr[arr.length - 1];
        }
      },
      type: 'band',
      paddingInner: 0.4
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用,不要拷贝
window['vchart'] = vchart;
```

#### 自定义总计计算方式

通过`waterfallChart.total.type: 'custom'`可以指定自定义计算方式，并将其视作总计图元。
具体配置如下:

- `waterfallChart.total.type: 'custom'` 声明统计方式
- `waterfallChart.total.tagField`声明总计值的标志位，对应`field`的值为`true`时，认为**这条数据是总计数据**
- `waterfallChart.total.product`: 总计数据在运算时会调用这个函数，参数为**当前总计数据，当前累计信息**，需要返回**总计的起点值与终点值**。回调函数定义如下：

```ts
(datum: Datum, current: { start: number; end: number }) => {
  start: number;
  end: number;
};
```

```javascript livedemo
const spec = {
  type: 'waterfall',
  data: {
    id: 'id0',
    values: [
      { x: '小计', total: true },

      { x: '0', y: 20, type: 'A' },
      { x: '1', y: 20, type: 'A' },
      { x: '2', y: 20, type: 'A' },
      { x: '3', y: 20, type: 'A' },
      { x: '4', y: 20, type: 'A' },
      { x: '5', y: 20, type: 'A' },

      { x: '0', y: 11, type: 'B' },
      { x: '1', y: 20, type: 'B' },
      { x: '2', y: 20, type: 'B' },
      { x: '3', y: 20, type: 'B' },
      { x: '4', y: 20, type: 'B' },
      { x: '5', y: 20, type: 'B' },

      { x: '总计', total: true }
    ]
  },
  legends: { visible: true, orient: 'bottom' },
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  total: {
    type: 'custom',
    tagField: 'total',
    product: (datum, current) => {
      if (datum.x === '小计') {
        return {
          start: 0,
          end: 100
        };
      }
      return {
        start: 0,
        end: current.end
      };
    }
  },
  axes: [
    { orient: 'left', range: { min: 0 } },
    { orient: 'bottom', label: { visible: true }, type: 'band', paddingInner: 0.4 }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
