# Waterfall Chart

[Configuration Manual](../../../option/waterfallChart)

## Introduction

Waterfall charts visually represent the cumulative process of numerical values in the form of bar charts. They are commonly used to analyze and explain the cumulative impact of individual data changes, such as the sources and factors of changes in income or expenditure.

## Chart Composition

Waterfall charts are composed of bar chart elements, guidewire chart elements, coordinate axes, and other components.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf06.png)

Rectangular chart elements are the basic elements of waterfall charts, and related drawing configurations are essential:

- `waterfallChart.type`: Chart type, the type of waterfall chart is `'waterfall'`
- `waterfallChart.data`: Data source for chart rendering
- `waterfallChart.xField`: Categorical field, mapping rectangle chart element's x-coordinate or width
- `waterfallChart.yField`: Numeric field, mapping rectangle chart element's height or y-coordinate
- `waterfallChart.total`: Used to configure this **rectangular chart element corresponding to the total calculated data** of the chart, see [waterfallChart.total](../../../option/waterfallChart#total) for detailed configuration

Coordinate axes, tooltip information, and other components that serve as auxiliary chart displays are optional configurations with default effects and features:

- `waterfallChart.axes`: Coordinate axis component, by default it is displayed and automatically inferred coordinate system and data mapping logic based on the chart type, see [VChart coordinate axis component configuration](../../../option/waterfallChart#axes) for detailed configuration
- `waterfallChart.tooltip`: Tooltip information, displayed by default during interaction, see [VChart tooltip information component configuration](../../../option/waterfallChart#tooltip) for detailed configuration
- For more component configurations, see [VChart waterfallChart configuration](../../../option/waterfallChart)

## Quick Start

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

## Waterfall Chart features

### Data

- A `discrete` field, such as `product`
- A `numeric` field, such as `sales`

A data definition for a series of product categories and sales figures is as follows:

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

### Data and Layout

Waterfall charts are a type of chart that displays the flow or cumulative changes of numerical values. In VChart, there are three ways to draw cumulative values:

- Add total information at the end and draw the total element
- Specify a certain field as total information and treat it as a total chart element
- Custom total

#### Add total information at the end and draw the total element

By using `waterfallChart.total.type: 'end'`, you can append the total information at the end. The specific configuration is as follows:

- `waterfallChart.total.type: 'end'` declares the calculation method
- `waterfallChart.total.text` declares the total text

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

#### Specify a certain field as total information and treat it as a total chart element

By using `waterfallChart.total.type: 'field'`, you can specify a certain field as total information and treat it as a total chart element. The specific configuration is as follows:

- `waterfallChart.total.type: 'field'` declares the calculation method
- `waterfallChart.total.tagField` declares the flag for the total value, when the value of the `field` is `true`, it is considered **this data is total data**
- `waterfallChart.total.valueField` can specify the total value
- `waterfallChart.total.startField` can specify the starting point of the total
- `waterfallChart.total.collectCountField` can specify the fields of the first `n` dimensions to be calculated before the total, for example, if this field specifies `'collect'`, then **the `n` read from the `'collect'` field in the data recognized as total data**.

```javascript livedemo
const spec = {
  type: 'waterfall',
  data: [
    {
      id: 'id0',
      values: [
        { x: '一季度-第一产业', y: 10954, type: '第一产业' },
        { x: '一季度-第二产业', y: 106187, type: '第二产业' },
        { x: '一季度-第三产业', y: 153037, type: '第三产业' },
        { x: '一季度', total: true, collect: 3 },
        { x: '二季度-第一产业', y: 18183, type: '第一产业' },
        { x: '二季度-第二产业', y: 122450, type: '第二产业' },
        { x: '二季度-第三产业', y: 151831, type: '第三产业' },
        { x: '二季度', total: true, collect: 3 },
        { x: '三季度-第一产业', y: 25642, type: '第一产业' },
        { x: '三季度-第二产业', y: 121553, type: '第二产业' },
        { x: '三季度-第三产业', y: 160432, type: '第三产业' },
        { x: '三季度', total: true, collect: 3 },
        { x: '四季度-第一产业', y: 33497, type: '第一产业' },
        { x: '四季度-第二产业', y: 132601, type: '第二产业' },
        { x: '四季度-第三产业', y: 169411, type: '第三产业' },
        { x: '四季度', total: true, collect: 3 },
        { x: '全年', total: true }
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
    text: '2022年中国各季度GPD'
  },
  legends: { visible: true, orient: 'bottom' },
  axes: [
    { orient: 'left', title: { visible: true, text: '单位：亿元' } },
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

#### Custom total calculation method

By using `waterfallChart.total.type: 'custom'`, you can specify a custom calculation method and treat it as a total chart element. The specific configuration is as follows:

- `waterfallChart.total.type: 'custom'` declares the calculation method
- `waterfallChart.total.tagField` declares the flag for the total value, when the value of the `field` is `true`, it is considered **this data is total data**
- `waterfallChart.total.product`: The total data will call this function during calculation, with parameters being **the current total data and the current cumulative information**, and needs to return **the starting and ending values of the total**. The callback function is defined as follows:

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
