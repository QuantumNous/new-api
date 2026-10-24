# Bar Chart / Bar Graph

[\[Configuration Manual\]](../../../option/barChart)

## Introduction

A bar chart is a statistical chart with a variable based on the length of a rectangle. Bar charts are used to compare two or more values (different times or different conditions), with only one variable, and are often used for smaller data set analysis.

In VChart, you can display data values for multiple groups through the [Bar Chart Configuration](../../../option/barChart). As shown in the following figure:
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/45df54929d214e7453e228f27.png)
In the [example](../../../demo/bar-chart/group-stack-column) shown above, you need the following key configurations:

- Set the mapping field for the x-axis and the **grouping field** on the `xField` property.
- `seriesField` property declares the color mapping field.
- `stack` property declares as true to configure stacking, which will be stacked based on the field declared by the `seriesField` property.
- Customize the colors using the `color` property.

A bar graph is a bar chart with a transpose of the x and y axes. The configuration is basically consistent with the bar chart, except for the need to swap the x and y axis configurations and add the `direction` property configuration set to `'horizontal'`.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e62252321d.png)

To achieve a [Population Pyramid Chart](../../../demo/bar-chart/population-pyramid) as shown above, you need to use a combination of chart + bar series + layout with the following configurations:

- Grid layout, configured through the `layout` property, used for bar chart layout.
- Use the `type: common` type, i.e., the combination chart.
- `xAxis` and `yAxis` `reverse` property, used to achieve bar chart inversion.

## Chart Components

A bar chart consists of rectangular elements, axes, and other components.
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf04.png)

Rectangle elements are the basic elements of bar charts/bar graphs, and the corresponding drawing configurations are essential:

- `barChart.type`: chart type, the type of bar chart / bar graph is `'bar'`
- `barChart.data`: data source for chart drawing
- `barChart.xField`: categorical field, mapping the x-coordinate/width of the element
- `barChart.yField`: numerical field, mapping the height/y-coordinate of the element

Coordinate axis, prompt information, and other components are optional configurations for assisting in chart presentation and come with default effects and functions:

- `barChart.axes`: coordinate axis component, default displayed, and automatically infer coordinate system and data mapping logic based on chart type, detailed configuration see [VChart Coordinate Axis Component Configuration](../../../option/barChart#axes)
- `barChart.tooltip`: prompts information, default interaction display, detailed configuration see [VChart Tooltip Component Configuration](../../../option/barChart#tooltip)
- More component configurations see [VChart barChart configuration](../../../option/barChart)

## Quick Start

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

### Key Configurations

- Set the `direction` property to `'horizontal'`.
- Declare the `xField` property as the numerical field.
- Declare the `yField` property as the categorical field.

## Bar Chart/Bar Graph Feature

### Data

#### Data Structure

- One `discrete` field, e.g. `product`
- One `numeric` field, e.g. `sales`

A data definition for a group of product categories and sales is as follows:

```ts
data: [
  {
    name: 'bar',
    values: [
      {
        product: 'Digital Products',
        sales: 20
      },
      {
        product: 'Daily Necessities',
        sales: 50
      },
      {
        product: 'Food',
        sales: 80
      }
    ]
  }
];
```

#### Positive and Negative Value Scenarios

In real-world scenarios, the data will often contain both positive and negative numbers, such as the difference in sales or revenue from the previous week. In this scenario, we need to distinguish between positive and negative numbers by the coordinate axis zero point. In VChart, you don't need to do any processing for this data scenario. The coordinate axis will adapt to the data range and display it in the best possible way.

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

### Chart Layout

#### Bar Graph

Setting the `direction` property to `'horizontal'` will create a bar graph.

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

#### Grouped Bar Chart

A grouped bar chart can be thought of as a combination of different basic bar series arranged in intervals, with each bar series representing a category. For example, you can break down a group of products into different subcategories such as color, size, style, etc. Each subcategory is represented by a different color so users can more intuitively compare the size and difference of the values.
In VChart, you need to append a field to `xField` (which will be an array at this point) to distinguish between data categories, i.e., to split the bars of the same dimension into several groups to be displayed in an interval arrangement. To distinguish between the interval-arranged columns within the same dimension, you need to specify the `barChart.seriedField` field for mapping the column color by default.

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

#### Stacked Bar Chart

A stacked bar chart can be thought of as a combination of different basic bar series stacked together with each bar series representing a category. Unlike grouped bar charts, stacked bar charts have the advantage of not only showcasing the data differences of different categories within the same dimension, but also exhibiting the total differences of different categories within the same dimension. The disadvantage is that when there are too many categories and the values are relatively small, it is difficult to discern the height difference of the bars visually.  
In VChart, to display a stacked bar chart, you need to configure `barChart.stack: true`, and to distinguish the stacked bars within the same dimension, you need to specify the `barChart.seriedField` field, which by default maps the bar color.

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

#### Percentage Stacked Bar Chart

In the previous section, we mentioned that the disadvantage of stacked bar charts is that when there are too many categories and the values are relatively small, it is difficult to discern the height differences of bars within the same dimension. For this scenario, we can use percentage stacked bar charts, which can help us obtain the height mapped by the normalized values within the same dimension and help us better identify the differences.
In VChart, to display a stacked bar chart, you need to configure `barChart.stack: true` and `barChart.percent: true`, and to distinguish the stacked bars within the same dimension, you need to specify the `barChart.seriedField` field, which by default maps the bar color.

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

### Chart Elements and Styles

#### Linear Gradient

By configuring `barChart.bar.style.fill: { gradient: 'linear' }`, you can achieve a gradient bar effect.

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
