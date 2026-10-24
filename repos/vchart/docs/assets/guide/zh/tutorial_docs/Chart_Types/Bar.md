# 柱状图/条形图

[\[配置项\]](../../../option/barChart)

## 简介

柱状图是一种以长方形的长度为变量的统计图表。柱状图用来比较两个或以上的价值（不同时间或者不同条件），只有一个变量，通常利用于较小的数据集分析。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/45df54929d214e7453e228f27.png)

条形图是在柱状图的基础上，做了 x 轴和 y 轴的转置，在配置上和柱状图基本一致，只是 x 轴和 y 轴的配置需要对调，同时需要加上 `direction` 属性配置为 `'horizontal'`。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e62252321d.png)

## 图表构成

柱状图由矩形图元、坐标轴及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf04.png)
矩形图元为柱状图/条形图的基本要素，相关的绘制配置必不可少:

- `barChart.type`: 图表类型，柱状体 / 条形图的类型为`'bar'`
- `barChart.data`: 图表绘制的数据源
- `barChart.xField`: 分类字段，映射图元的 x 坐标 / 宽度
- `barChart.yField`: 数值字段，映射图元的高度 / y 坐标

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `barChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/barChart#axes)
- `barChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/barChart#tooltip)
- 更多组件配置见[VChart barChart 配置](../../../option/barChart)

## 快速上手

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 关键配置

- `direction` 属性配置为 `'horizontal'`
- `xField` 属性声明为数值字段
- `yField` 属性声明为分类字段

## 柱状图/条形图特性

### 数据

#### 数据结构

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

#### 数据正负值场景

在真实场景中，数据中通常会同时出现正数、负数，比如销量、营业额同上周的差异值。在这种场景下，我们需要通过坐标轴的零点进行正负数的区分。在 VChart 中，您无需针对这种数据场景做任何处理，坐标轴会根据数据范围做自适应处理，以最佳方式呈现。

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          date: '2019-08-29',
          group: 'Cake',
          value: 154,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'Bread',
          value: 378,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'Tea',
          value: 103,
          stack: 'Drink'
        },
        {
          date: '2019-08-29',
          group: 'Coffee',
          value: 310,
          stack: 'Drink'
        },
        {
          date: '2019-08-29',
          group: 'Rib',
          value: 419,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-29',
          group: 'Crayfish',
          value: 810,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-30',
          group: 'Cake',
          value: 153,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'Bread',
          value: 398,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'Tea',
          value: 105,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'Coffee',
          value: 298,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'Rib',
          value: 416,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-30',
          group: 'Crayfish',
          value: 796,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-31',
          group: 'Cake',
          value: 151,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'Bread',
          value: 408,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'Tea',
          value: 110,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'Coffee',
          value: 302,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'Rib',
          value: 400,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-31',
          group: 'Crayfish',
          value: 811,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-01',
          group: 'Cake',
          value: 135,
          stack: 'Dessert'
        },
        {
          date: '2019-09-01',
          group: 'Bread',
          value: 407,
          stack: 'Dessert'
        },
        {
          date: '2019-09-01',
          group: 'Tea',
          value: 944,
          stack: 'Drink'
        },
        {
          date: '2019-09-01',
          group: 'Coffee',
          value: 298,
          stack: 'Drink'
        },
        {
          date: '2019-09-01',
          group: 'Rib',
          value: 343,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-01',
          group: 'Crayfish',
          value: 771,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-02',
          group: 'Cake',
          value: 997,
          stack: 'Dessert'
        },
        {
          date: '2019-09-02',
          group: 'Bread',
          value: 363,
          stack: 'Dessert'
        },
        {
          date: '2019-09-02',
          group: 'Tea',
          value: 636,
          stack: 'Drink'
        },
        {
          date: '2019-09-02',
          group: 'Coffee',
          value: 239,
          stack: 'Drink'
        },
        {
          date: '2019-09-02',
          group: 'Rib',
          value: 204,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-02',
          group: 'Crayfish',
          value: 641,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-03',
          group: 'Cake',
          value: 984,
          stack: 'Dessert'
        },
        {
          date: '2019-09-03',
          group: 'Bread',
          value: 356,
          stack: 'Dessert'
        },
        {
          date: '2019-09-03',
          group: 'Tea',
          value: 627,
          stack: 'Drink'
        },
        {
          date: '2019-09-03',
          group: 'Coffee',
          value: 241,
          stack: 'Drink'
        },
        {
          date: '2019-09-03',
          group: 'Rib',
          value: 231,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-03',
          group: 'Crayfish',
          value: 646,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-04',
          group: 'Cake',
          value: 943,
          stack: 'Dessert'
        },
        {
          date: '2019-09-04',
          group: 'Bread',
          value: 355,
          stack: 'Dessert'
        },
        {
          date: '2019-09-04',
          group: 'Tea',
          value: 611,
          stack: 'Drink'
        },
        {
          date: '2019-09-04',
          group: 'Coffee',
          value: 259,
          stack: 'Drink'
        },
        {
          date: '2019-09-04',
          group: 'Rib',
          value: 230,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-04',
          group: 'Crayfish',
          value: 666,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-29',
          group: 'Cake(last week)',
          value: -365,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'Bread(last week)',
          value: -235,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'Tea(last week)',
          value: -832,
          stack: 'Drink'
        },
        {
          date: '2019-08-29',
          group: 'Coffee(last week)',
          value: -610,
          stack: 'Drink'
        },
        {
          date: '2019-08-29',
          group: 'Rib(last week)',
          value: -305,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-29',
          group: 'Crayfish(last week)',
          value: -462,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-30',
          group: 'Cake(last week)',
          value: -522,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'Bread(last week)',
          value: -258,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'Tea(last week)',
          value: -689,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'Coffee(last week)',
          value: -688,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'Rib(last week)',
          value: -106,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-30',
          group: 'Crayfish(last week)',
          value: -159,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-31',
          group: 'Cake(last week)',
          value: -352,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'Bread(last week)',
          value: -760,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'Tea(last week)',
          value: -332,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'Coffee(last week)',
          value: -368,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'Rib(last week)',
          value: -222,
          stack: 'Meat dishes'
        },
        {
          date: '2019-08-31',
          group: 'Crayfish(last week)',
          value: -205,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-01',
          group: 'Cake(last week)',
          value: -471,
          stack: 'Dessert'
        },
        {
          date: '2019-09-01',
          group: 'Bread(last week)',
          value: -535,
          stack: 'Dessert'
        },
        {
          date: '2019-09-01',
          group: 'Tea(last week)',
          value: -319,
          stack: 'Drink'
        },
        {
          date: '2019-09-01',
          group: 'Coffee(last week)',
          value: -363,
          stack: 'Drink'
        },
        {
          date: '2019-09-01',
          group: 'Rib(last week)',
          value: -243,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-01',
          group: 'Crayfish(last week)',
          value: -129,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-02',
          group: 'Cake(last week)',
          value: -319,
          stack: 'Dessert'
        },
        {
          date: '2019-09-02',
          group: 'Bread(last week)',
          value: -570,
          stack: 'Dessert'
        },
        {
          date: '2019-09-02',
          group: 'Tea(last week)',
          value: -532,
          stack: 'Drink'
        },
        {
          date: '2019-09-02',
          group: 'Coffee(last week)',
          value: -312,
          stack: 'Drink'
        },
        {
          date: '2019-09-02',
          group: 'Rib(last week)',
          value: -583,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-02',
          group: 'Crayfish(last week)',
          value: -342,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-03',
          group: 'Cake(last week)',
          value: -346,
          stack: 'Dessert'
        },
        {
          date: '2019-09-03',
          group: 'Bread(last week)',
          value: -373,
          stack: 'Dessert'
        },
        {
          date: '2019-09-03',
          group: 'Tea(last week)',
          value: -582,
          stack: 'Drink'
        },
        {
          date: '2019-09-03',
          group: 'Coffee(last week)',
          value: -247,
          stack: 'Drink'
        },
        {
          date: '2019-09-03',
          group: 'Rib(last week)',
          value: -294,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-03',
          group: 'Crayfish(last week)',
          value: -165,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-04',
          group: 'Cake(last week)',
          value: -326,
          stack: 'Dessert'
        },
        {
          date: '2019-09-04',
          group: 'Bread(last week)',
          value: -879,
          stack: 'Dessert'
        },
        {
          date: '2019-09-04',
          group: 'Tea(last week)',
          value: -219,
          stack: 'Drink'
        },
        {
          date: '2019-09-04',
          group: 'Coffee(last week)',
          value: -236,
          stack: 'Drink'
        },
        {
          date: '2019-09-04',
          group: 'Rib(last week)',
          value: -153,
          stack: 'Meat dishes'
        },
        {
          date: '2019-09-04',
          group: 'Crayfish(last week)',
          value: -253,
          stack: 'Meat dishes'
        }
      ]
    }
  ],
  xField: ['date', 'stack'],
  yField: 'value',
  seriesField: 'group',
  stack: true,
  axes: [
    {
      orient: 'left',
      title: {
        visible: true,
        text: 'Week-on-week (sales)'
      },
      tick: {
        tickCount: 10
      }
    },
    {
      orient: 'bottom',
      domainLine: {
        onZero: true // Axis baseline is at value 0
      }
    }
  ],
  legends: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### 图表布局

#### 条形图

`direction` 属性配置为 `'horizontal'`即可得到一张条形图。

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'Apple',
          value: 214480
        },
        {
          name: 'Google',
          value: 155506
        },
        {
          name: 'Amazon',
          value: 100764
        },
        {
          name: 'Microsoft',
          value: 92715
        },
        {
          name: 'Coca-Cola',
          value: 66341
        },
        {
          name: 'Samsung',
          value: 59890
        },
        {
          name: 'Toyota',
          value: 53404
        },
        {
          name: 'Mercedes-Benz',
          value: 48601
        },
        {
          name: 'Facebook',
          value: 45168
        },
        {
          name: "McDonald's",
          value: 43417
        },
        {
          name: 'Intel',
          value: 43293
        },
        {
          name: 'IBM',
          value: 42972
        },
        {
          name: 'BMW',
          value: 41006
        },
        {
          name: 'Disney',
          value: 39874
        },
        {
          name: 'Cisco',
          value: 34575
        },
        {
          name: 'GE',
          value: 32757
        },
        {
          name: 'Nike',
          value: 30120
        },
        {
          name: 'Louis Vuitton',
          value: 28152
        },
        {
          name: 'Oracle',
          value: 26133
        },
        {
          name: 'Honda',
          value: 23682
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'name',
  axes: [
    {
      orient: 'bottom',
      visible: false
    }
  ],
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 分组柱状图

分组柱状图可以看做不同的基础柱系列以间隔排列的方式组合在一起，每组柱系列代表一个类别。例如，您可以将一组产品拆分为不同的子类别，如颜色、大小、风格等。每个子类别都用不同的颜色表示，使用户能够更直观地比较数值的大小和差异。
在 VChart 中，需要在`xField`中追加字段（此时`xField`以数组形式存在），该字段用于区分数据类别，即对同一维度的柱子进行拆分，拆分成若干组以间隔排列的方式展开。并且为了区分同一维度下间隔排列的柱子，需要指定`barChart.seriedField`字段，该字段默认映射柱子颜色。

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1930', value: 129 },
        { type: 'Autocracies', year: '1940', value: 133 },
        { type: 'Autocracies', year: '1950', value: 130 },
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
        { type: 'Democracies', year: '1930', value: 22 },
        { type: 'Democracies', year: '1940', value: 13 },
        { type: 'Democracies', year: '1950', value: 25 },
        { type: 'Democracies', year: '1960', value: 29 },
        { type: 'Democracies', year: '1970', value: 38 },
        { type: 'Democracies', year: '1980', value: 41 },
        { type: 'Democracies', year: '1990', value: 57 },
        { type: 'Democracies', year: '2000', value: 87 },
        { type: 'Democracies', year: '2010', value: 98 },
        { type: 'Democracies', year: '2018', value: 99 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'top',
    position: 'start',
    padding: {
      bottom: 10
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 堆叠柱状图

堆叠柱状图可以看做不同的基础柱系列以堆叠的方式组合在一起，每组柱系列代表一个类别。不同于分组柱状图，堆叠柱状图的优点是：不仅能展现同一维度下不同类别的数据差异，还能展现同一维度下不同类别的总和差异；缺点则是当类别过多且数值较小时，柱形的高度差异难以从视觉层面辨认。  
在 VChart 中，如果需要展示堆叠柱状图，需要配置`barChart.stack: true`, 并且为了区分同一维度下堆叠在一起的柱子，需要指定`barChart.seriedField`字段，该字段默认映射柱子颜色。

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          年龄段: '小于5岁',
          人口数量: 25635
        },
        {
          State: 'WY',
          年龄段: '5至13岁',
          人口数量: 1890
        },
        {
          State: 'WY',
          年龄段: '14至17岁',
          人口数量: 9314
        },
        {
          State: 'DC',
          年龄段: '小于5岁',
          人口数量: 30352
        },
        {
          State: 'DC',
          年龄段: '5至13岁',
          人口数量: 20439
        },
        {
          State: 'DC',
          年龄段: '14至17岁',
          人口数量: 10225
        },
        {
          State: 'VT',
          年龄段: '小于5岁',
          人口数量: 38253
        },
        {
          State: 'VT',
          年龄段: '5至13岁',
          人口数量: 42538
        },
        {
          State: 'VT',
          年龄段: '14至17岁',
          人口数量: 15757
        },
        {
          State: 'ND',
          年龄段: '小于5岁',
          人口数量: 51896
        },
        {
          State: 'ND',
          年龄段: '5至13岁',
          人口数量: 67358
        },
        {
          State: 'ND',
          年龄段: '14至17岁',
          人口数量: 18794
        },
        {
          State: 'AK',
          年龄段: '小于5岁',
          人口数量: 72083
        },
        {
          State: 'AK',
          年龄段: '5至13岁',
          人口数量: 85640
        },
        {
          State: 'AK',
          年龄段: '14至17岁',
          人口数量: 22153
        }
      ]
    }
  ],
  xField: 'State',
  yField: '人口数量',
  seriesField: '年龄段',
  stack: true,
  legends: {
    visible: true
  },
  bar: {
    // 配置柱图 hover 时的样式
    state: {
      hover: {
        stroke: '#000',
        lineWidth: 1
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### 百分比堆叠柱状图

在上节中我们提到堆叠柱状图的缺点是当类别过多且数值过小时，同一维度下的柱形高度差异难以辨认。针对这种场景，我们可以声明百分比堆叠柱状图，它可以帮助我们得到同一维度下归一化后的
数值所映射的高度，帮助我们更好的辨别差异。  
在 VChart 中，如果需要展示堆叠柱状图，需要配置`barChart.stack: true` 和 `barChart.percent: true` ，并且为了区分同一维度下堆叠在一起的柱子，需要指定`barChart.seriedField`字段，该字段默认映射柱子颜色。

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          年龄段: '小于5岁',
          人口数量: 25635
        },
        {
          State: 'WY',
          年龄段: '5至13岁',
          人口数量: 1890
        },
        {
          State: 'WY',
          年龄段: '14至17岁',
          人口数量: 9314
        },
        {
          State: 'DC',
          年龄段: '小于5岁',
          人口数量: 30352
        },
        {
          State: 'DC',
          年龄段: '5至13岁',
          人口数量: 20439
        },
        {
          State: 'DC',
          年龄段: '14至17岁',
          人口数量: 10225
        },
        {
          State: 'VT',
          年龄段: '小于5岁',
          人口数量: 38253
        },
        {
          State: 'VT',
          年龄段: '5至13岁',
          人口数量: 42538
        },
        {
          State: 'VT',
          年龄段: '14至17岁',
          人口数量: 15757
        },
        {
          State: 'ND',
          年龄段: '小于5岁',
          人口数量: 51896
        },
        {
          State: 'ND',
          年龄段: '5至13岁',
          人口数量: 67358
        },
        {
          State: 'ND',
          年龄段: '14至17岁',
          人口数量: 18794
        },
        {
          State: 'AK',
          年龄段: '小于5岁',
          人口数量: 72083
        },
        {
          State: 'AK',
          年龄段: '5至13岁',
          人口数量: 85640
        },
        {
          State: 'AK',
          年龄段: '14至17岁',
          人口数量: 22153
        }
      ]
    }
  ],
  xField: 'State',
  yField: '人口数量',
  seriesField: '年龄段',
  percent: true,
  stack: true,
  legends: {
    visible: true
  },
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod: val => {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    }
  ],
  tooltip: {
    mark: { visible: false }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 图元及样式

#### 线性渐变

通过` barChart.bar.style.fill: { gradient: 'linear' }` 配置渐变颜色，可以得到渐变柱的效果。

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'data',
      values: [
        {
          x: 'Mon',
          y: 100,
          type: '销售额'
        },
        {
          x: 'Tues',
          y: 66,
          type: '销售额'
        },
        {
          x: 'Wed',
          y: 95,
          type: '销售额'
        },
        {
          x: 'Thus',
          y: 52,
          type: '销售额'
        },
        {
          x: 'Fri',
          y: 68,
          type: '销售额'
        },
        {
          x: 'Sat',
          y: 52,
          type: '销售额'
        },
        {
          x: 'sun',
          y: 48,
          type: '销售额'
        },
        {
          x: 'Mon',
          y: 43,
          type: '利润'
        },
        {
          x: 'Tues',
          y: 80,
          type: '利润'
        },
        {
          x: 'Wed',
          y: 68,
          type: '利润'
        },
        {
          x: 'Thus',
          y: 40,
          type: '利润'
        },
        {
          x: 'Fri',
          y: 53,
          type: '利润'
        },
        {
          x: 'Sat',
          y: 72,
          type: '利润'
        },
        {
          x: 'sun',
          y: 71,
          type: '利润'
        }
      ]
    }
  ],
  xField: ['x', 'type'],
  yField: 'y',
  seriesField: 'type',
  bar: {
    style: {
      cornerRadius: 10,
      fill: {
        gradient: 'linear',
        x0: 0.5,
        y0: 0,
        x1: 0.5,
        y1: 1,
        stops: [
          {
            offset: 0,
            color: '#86DF6C'
          },
          {
            offset: 1,
            color: '#468DFF'
          }
        ]
      }
    },
    state: {
      selected: {
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  axes: [
    {
      orient: 'bottom',
      domainLine: {
        visible: false
      },
      bandPadding: 0,
      paddingInner: 0.1
    },
    {
      orient: 'left',
      grid: {
        visible: false
      },
      tick: {
        visible: true,
        tickCount: 3
      },
      domainLine: {
        visible: false
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
