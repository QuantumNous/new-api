# Scatter Plot

[\[Option Manual\]](../../../option/scatterChart)

## Introduction

A scatter plot is a type of graph used to represent the relationship between two variables. It depicts the relationship between two variables by plotting a series of points on a cartesian coordinate plane, with the coordinates of the points representing the values of the variables. Scatter plots can help us intuitively observe the relationship between two variables, such as whether there is a linear relationship, whether there is some trend, whether there are outliers, etc.

As mentioned earlier, a scatter plot uses the position of points to represent the relationship between two variables. The size or color of the points can be used to distinguish categories. In VChart, you can specify the size of the scatter points using `scatterChart.sizeField` to represent the differences in variable values, and this visualization method of specifying the size of points is also called bubble chart.

### Chart Composition

A scatter plot consists of point elements, axes, tooltip information, and other components.
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda0a.png)

- `scatterChart.type`: Chart type, scatter plot type is `'scatter'`
- `scatterChart.data`: Data source for chart rendering
- `scatterChart.xField`: Category/value field, maps point element's x-coordinate
- `scatterChart.yField`: Category/value field, maps point element's y-coordinate
- `scatterChart.sizeField`: Value field, maps point element's size

Axes, tooltip information, and other components are optional configurations that assist the chart display and come with default effects and capabilities:

- `scatterChart.axes`: Axis component, displayed by default, and automatically infers coordinate system and data mapping logic based on chart type, detailed configuration see [VChart Axis Component Configuration](../../../option/scatterChart#axes)
- `scatterChart.tooltip`: Tooltip information, displayed during interaction by default, detailed configuration see [VChart Tooltip Component Configuration](../../../option/scatterChart#tooltip)
- For more component configurations, see [VChart scatterChart configuration](../../../option/scatterChart)

### Quick Start

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

### Key Configuration

- `categoryField` property declares a category field
- `valueField` property declares a value field

## Scatter Plot Features

### Data

- A `Discrete`/ `Numerical` field, e.g.: `product`, maps point element's x-coordinate
- A `Discrete`/ `Numerical` field, e.g.: `sales`, maps point element's y-coordinate

Optional:

- A `Numerical` field, e.g.: `count`, maps point element's size
- A `Discrete` field, e.g.: `type`, maps point element's shape

A dataset of product categories and sales is defined as follows:

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
        type: 'Daily Necessities'
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

### Elements and Styles

Since scatter plots have flexible data display capabilities, a single point element represents a data record, so people often assign more data significance to it in other visual channels, such as shape, size, etc.

#### Shape

You can specify the shape mapping field and mapping range for the scatter plot respectively through `scatterChart.shapeField` and `scatterChart.shape`.

The declaration of `scatterChart.shape` is as follows:

```ts
  size: {
    type: 'ordinal', // Mapping type, 'linear' can also be selected
    range: [10, 30, 50] // Mapping range
  }
```

Alternatively, you can directly specify the mapping relationship via the callback form.
Declare the following in `scatterChart.shape`:

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

#### Size

You can specify the shape mapping field and mapping range for the scatter plot respectively through `scatterChart.sizeField` and `scatterChart.size`.
The declaration of `scatterChart.size` is as follows:

```ts
  size: {
    type: 'linear', // Mapping type
    range: [10, 30] // Mapping range
  }
```

Or you can directly specify the mapping relationship by a callback,
Declare below in `scatterChart.size`:

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```
