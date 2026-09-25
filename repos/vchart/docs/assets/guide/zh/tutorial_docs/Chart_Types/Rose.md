# 玫瑰图

[\[配置项\]](../../../option/roseChart)

## 简介

玫瑰图是在极坐标系下绘制的统计图表，数据中的每个类别被分成相等的部分，每个部分从中心向外延伸的距离取决于它所代表的值。玫瑰图适合展示循环数据（月份、季节等），曾被英国统计学家弗洛伦斯·南丁格尔用来展示克里米亚战争期间士兵的死亡人数。

在 VChart 中，玫瑰图与饼图的区别是**饼图用扇区角度范围表示数值的差异而扇区半径保持一致**，而**玫瑰图用扇区半径表示数值差异而扇区角度范围**保持一致。正是不同半径的扇区才构成了错落有致的“玫瑰花瓣”。

## 图表构成

玫瑰图由扇区图元及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda08.png)

扇区图元为玫瑰图的基本要素，相关的绘制配置必不可少:

- `roseChart.type`: 图表类型，饼/环图的类型为`'rose'`
- `roseChart.data`: 图表绘制的数据源
- `roseChart.categoryField`: 分类字段，映射不同扇区图元
- `roseChart.valueField`: 数值字段，映射图元的扇区半径
- `roseChart.seriesField`: 分类字段，映射图元的扇区颜色

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `roseChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/roseChart#axes)
- `roseChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/roseChart#tooltip)
- 更多组件配置见[VChart roseChart 配置](../../../option/roseChart)

## 玫瑰图特性

### 数据

- 一个`离散` 字段，如: `product`，用于映射不同扇区
- 一个`数值`字段，如: `sales`，用于映射扇区半径

一组产品类别和 sales 的数据定义如下：

```ts
data: [
  {
    name: 'rose',
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

### 分组玫瑰图

分组玫瑰图可以看作 **'弯曲后的分组柱状图'**，它将不同类别的玫瑰系列沿着极坐标系以间隔的方式排列在一起，每组玫瑰系列代表一个类别。

在 VChart 中，需要在`categoryField`中追加字段（此时`categoryField`以数组形式存在），该字段用于区分数据类别，即对同一维度的玫瑰系列进行拆分，拆分成若干组以间隔排列的方式展开。并且为了区分同一维度下间隔排列的柱子，需要指定`roseChart.seriedField`字段，该字段默认映射扇区颜色。

```javascript livedemo
const data = {
  id: '0',
  values: [
    {
      time: '2:00',
      value: 27,
      type: 'sales'
    },
    {
      time: '6:00',
      value: 25,
      type: 'sales'
    },
    {
      time: '10:00',
      value: 18,
      type: 'sales'
    },
    {
      time: '14:00',
      value: 15,
      type: 'sales'
    },
    {
      time: '18:00',
      value: 10,
      type: 'sales'
    },
    {
      time: '22:00',
      value: 5,
      type: 'sales'
    },
    {
      time: '2:00',
      value: 7,
      type: 'count'
    },
    {
      time: '6:00',
      value: 5,
      type: 'count'
    },
    {
      time: '10:00',
      value: 38,
      type: 'count'
    },
    {
      time: '14:00',
      value: 5,
      type: 'count'
    },
    {
      time: '18:00',
      value: 20,
      type: 'count'
    },
    {
      time: '22:00',
      value: 15,
      type: 'count'
    }
  ]
};

const spec = {
  type: 'rose',
  data,
  categoryField: ['time', 'type'],
  valueField: 'value',
  seriesField: 'type',
  outerRadius: 0.9,
  axes: [
    {
      orient: 'angle',
      domainLine: { visible: true },
      grid: { visible: true, alignWithLabel: false },
      label: {
        visible: true
      }
    },
    {
      orient: 'radius',
      grid: { visible: true, smooth: true }
    }
  ],
  crosshair: {
    categoryField: {
      visible: true,
      line: {
        type: 'rect'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 堆叠玫瑰图

堆叠玫瑰图可以看做 **'弯曲后的堆叠柱状图'**，它将不同类别的玫瑰系列以堆叠的方式组合在一起，每组玫瑰系列代表一个类别。
在 VChart 中，如果需要展示堆叠玫瑰图，需要配置`roseChart.stack: true`, 并且为了区分同一维度下堆叠在一起的扇区，需要指定`roseChart.seriedField`字段，该字段默认映射扇区颜色。

提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `roseChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../option/roseChart#tooltip)
- 更多组件配置见[VChart 组件配置](../../option/roseChart)

```javascript livedemo
const spec = {
  type: 'rose',
  data: [
    {
      values: [
        {
          time: '12814',
          month: 'Jan',
          level: '0-3'
        },
        {
          time: '3054',
          month: 'Jan',
          level: '3-6'
        },
        {
          time: '4376',
          month: 'Jan',
          level: '6-9'
        },
        {
          time: '4229',
          month: 'Jan',
          level: '9-12'
        },

        {
          time: '8814',
          month: 'Feb',
          level: '0-3'
        },
        {
          time: '5067',
          month: 'Feb',
          level: '3-6'
        },
        {
          time: '13987',
          month: 'Feb',
          level: '6-9'
        },
        {
          time: '3932',
          month: 'Feb',
          level: '9-12'
        },

        {
          time: '11624',
          month: 'Mar',
          level: '0-3'
        },
        {
          time: '7004',
          month: 'Mar',
          level: '3-6'
        },
        {
          time: '3574',
          month: 'Mar',
          level: '6-9'
        },
        {
          time: '5221',
          month: 'Mar',
          level: '9-12'
        },

        {
          time: '8814',
          month: 'Apr',
          level: '0-3'
        },
        {
          time: '9054',
          month: 'Apr',
          level: '3-6'
        },
        {
          time: '4376',
          month: 'Apr',
          level: '6-9'
        },
        {
          time: '5256',
          month: 'Apr',
          level: '9-12'
        },

        {
          time: '9998',
          month: 'May',
          level: '0-3'
        },
        {
          time: '5043',
          month: 'May',
          level: '3-6'
        },
        {
          time: '4572',
          month: 'May',
          level: '6-9'
        },
        {
          time: '3308',
          month: 'May',
          level: '9-12'
        },

        {
          time: '12321',
          month: 'Jun',
          level: '0-3'
        },
        {
          time: '15067',
          month: 'Jun',
          level: '3-6'
        },
        {
          time: '3417',
          month: 'Jun',
          level: '6-9'
        },
        {
          time: '5432',
          month: 'Jun',
          level: '9-12'
        }
      ]
    }
  ],
  categoryField: 'month',
  valueField: 'time',
  seriesField: 'level',
  outerRadius: 1,
  stack: true,
  title: {
    visible: true,
    text: 'Wind speed statistics for the first half of the year'
  },
  legends: [{ visible: true, position: 'middle', orient: 'left' }],
  color: ['#FFB84C', '#F266AB', '#A459D1', '#2CD3E1'],
  axes: [
    {
      orient: 'angle',
      domainLine: { visible: true, smooth: true },
      label: { visible: true },
      tick: { visible: true },
      grid: { visible: true },
      bandPadding: 0.05
    },
    {
      orient: 'radius',
      label: { visible: true },
      grid: { visible: true, smooth: true }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
