# Combination Chart

[\[Options Manual\]](../../../option/commonChart)

## Introduction

A combination chart is a type of data visualization chart that displays interdependent data sets combined in a single chart for better data analysis and comparison. Combination charts typically use multiple data series and visual elements such as line series, bar series, area series, scatter series, pie series, etc., to represent various types of data. In combination charts, each data series usually has its own legend and coordinate axis, and each axis can use different scale ranges and labels to more clearly represent different data.

The advantage of combination charts is that they can simultaneously present information from multiple data sets, providing a more comprehensive view of the overall trend and direction. By combining different data types, units, and measurements, combination charts can provide deeper and more comprehensive insights into complex data. Combination charts are widely used in various fields such as business, science, and medical to effectively analyze and compare various complex data.

In VChart, you can combine various series through the [combination chart configuration](../../../option/commonChart):
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/57a706137957fce7388f3ab01.png)

In the [combination chart example](../../../demo/combination/bar-combine) shown above, you need to use the following key configurations:

- `type: 'common'` declares a combination chart type
- `layout` attribute declares a custom combination chart layout

  - `layout.type` attribute declares the layout type, `grid` for row and column layout
  - `layout.col` attribute declares the number of columns (note: all independent elements in the chart need to occupy one column separately, e.g., data axis or other components, and chart series should each occupy one column)
  - `layout.row` attribute declares the number of rows (note: the same as above)
  - `layout.col` attribute specifies column width, supporting `{ index: xx, size: xx }` format, where `index` represents the index of the column, and `size` represents the column width
  - `layout.row` attribute specifies row height, supporting `{ index: xx, size: xx }` format, where `index` represents the index of the row, and `size` represents the row height
  - `layout.elements` attribute declares layout unit IDs for binding data series to layout units. Declare in `{modelId: xx, row: xx, col: xx}` format, where `modelId` represents the ID of the layout unit, and `row` and `col` represent the index of the row and column where the layout unit is located

- `region` attribute declares data regions for subsequent binding. Layout units using the same data need to bind to the same `regionId`, such as the coordinate axis and the layout unit where its corresponding chart series is located. Declare as `id: xx`, where `id` represents the data region ID

- `series` attribute declares different chart series. In the series configuration, `regionIndex` is used to bind the data region where the chart series is located. `id` is used to bind the axis where the layout unit is located, corresponding one-to-one with `layout.elements`' `modelId` (since there is a corresponding relationship between data region and `layout.elements`' `modelId`, there is no need to declare `id` here)

- `axes` attribute declares different coordinate axis components, `regionIndex` and `id` attributes are the same as above

## Instructions for use

**Because the combination chart does not limit the coordinate system, it cannot determine internally what type of coordinate axes should be created. Therefore, when configuring the combination chart, you must declare the `axes` attribute to declare what type of coordinate axes to use.**

1. For the Cartesian coordinate system, we need to declare the coordinate axis and type of the corresponding direction, for example:

```ts
axes: [
  { orient: 'left', type: 'linear' }, // Declare the left axis as a linear axis
  { orient: 'bottom', type: 'band' } // Declare the lower axis as a discrete axis
];
```

2. For the polar coordinate system, we need to declare the coordinate axis and type of the corresponding direction, for example:

```ts
axes: [
  { orient: 'angle', type: 'band' }, // Declare the arc axis as a discrete axis
  { orient: 'radius', type: 'linear' } // Declare the radius axis as a linear axis
];
```

## Chart Components

As the name suggests, a combination chart consists of different chart series, coordinate axes, tooltips, and other components combined. Theoretically, VChart supports all chart series combinations, but before that, some configurations are needed to determine the data, layouts, and other relationships of different series, so that different series can be placed reasonably and their correct graphic attributes can be obtained through data mapping.

- `commonChart.type: 'common'`: Chart type, combination chart type is `'common'`
- `commonChart.layout`: Determine combination chart layout

  - `commonChart.layout.type`: Layout type, `grid` for row and column layout
  - `commonChart.layout.col`: Number of columns (note: all independent elements in the chart need to occupy one column separately, e.g., data axis or other components, and chart series should each occupy one column)
  - `commonChart.layout.row`: Number of rows (note: the same as above)
  - `commonChart.layout.col`: Specify column width, supporting `{ index: xx, size: xx }` format, `index` represents the index of the column, `size` represents the column width
  - `commonChart.layout.row`: Specify row height, supporting `{ index: xx, size: xx }` format, `index` represents the index of the row, `size` represents the row height
  - `commonChart.layout.elements`: Layout unit IDs for binding data series to layout units. Declare in `{modelId: xx, row: xx, col: xx}` format, where `modelId` represents the ID of the layout unit, and `row` and `col` represent the index of the row and column where the layout unit is located

- `commonChart.region`: Determine data region for subsequent binding, layout units using the same data need to bind to the same `regionId`, such as coordinate axis and the layout unit where its corresponding chart series is located. Declare as `id: xx`, where `id` represents the data region ID

- `commonChart.series`: Declare different chart series, in the series configuration, `regionIndex` is used to bind the data region where the chart series is located. `id` is used to bind the axis where the layout unit is located, corresponding one-to-one with `layout.elements`' `modelId` (since there is a corresponding relationship between data region and `layout.elements`' `modelId`, there is no need to declare `id` here)

- `commonChart.axes`: Declare different coordinate axis components, `regionIndex` and `id` attributes are the same as above

## Combination Chart Features

### Dual-axis chart (bar chart + line chart)

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      label: { visible: true },
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0] },
    { orient: 'right', seriesId: ['line'], grid: { visible: false } },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Key configurations

- `type: 'common'` declares a combination chart type
- `axes` `seriesIndex` attribute is configured as the series index that the axis needs to associate with
- `axes` `seriesId` attribute is configured as an array of `series` `id` that the axis needs to associate with

### Line Pie Combination Chart (Pie Chart + Line Chart)

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
    padding: {
      top: 10
    },
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
vchart.on('dimensionHover', {}, params => {
  console.log(params);
});
// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Key configurations

- `type: 'common'` declares a combination chart type
- `layout` attribute configures the layout of multiple `regions`

### Polar Coordinate Combination Chart (Radar Chart + Rose Chart)

```javascript livedemo
const spec = {
  type: 'common',
  outerRadius: 0.9,
  series: [
    {
      type: 'rose',
      data: {
        values: [
          { key: 'North', value: 31 },
          { key: 'Northeast', value: 32 },
          { key: 'East', value: 21 },
          { key: 'Southeast', value: 15 },
          { key: 'South', value: 50 },
          { key: 'Southwest', value: 44 },
          { key: 'West', value: 32 },
          { key: 'Northwest', value: 32 },
          { key: 'North', value: 31 },
          { key: 'Northeast', value: 32 }
        ]
      },
      categoryField: 'key',
      valueField: 'value',
      stack: false,
      rose: {
        style: {
          lineWidth: 1,
          stroke: '#fff',
          fill: '#FF6666'
        }
      }
    },
    {
      type: 'radar',
      data: {
        values: [
          { key: 'North', value: 31, category: 'Destroyer' },
          { key: 'Northeast', value: 32, category: 'Destroyer' },
          { key: 'East', value: 21, category: 'Destroyer' },
          { key: 'Southeast', value: 15, category: 'Destroyer' },
          { key: 'South', value: 50, category: 'Destroyer' },
          { key: 'Southwest', value: 44, category: 'Destroyer' },
          { key: 'West', value: 32, category: 'Destroyer' },
          { key: 'Northwest', value: 32, category: 'Destroyer' },
          { key: 'North', value: 31, category: 'Destroyer' },
          { key: 'Northeast', value: 32, category: 'Destroyer' },
          { key: 'Southeast', value: 40, category: 'aircraft carrier' },
          { key: 'South', value: 25, category: 'aircraft carrier' },
          { key: 'Southwest', value: 22, category: 'aircraft carrier' },
          { key: 'West', value: 18, category: 'aircraft carrier' },
          { key: 'Northwest', value: 7, category: 'aircraft carrier' },
          { key: 'North', value: 24, category: 'aircraft carrier' },
          { key: 'Northeast', value: 43, category: 'aircraft carrier' },
          { key: 'East', value: 42, category: 'aircraft carrier' }
        ]
      },
      categoryField: 'key',
      valueField: 'value',
      seriesField: 'category',
      area: {
        style: {
          visible: datum => {
            return datum.category === 'Destroyer' ? false : true;
          },
          fillOpacity: 0.5
        }
      },
      line: {
        style: {
          lineWidth: 2
        }
      }
    }
  ],
  axes: [
    {
      orient: 'angle',
      grid: {
        alignWithLabel: false,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'radius',
      domainLine: {
        visible: false
      }
    }
  ],
  legends: {
    visible: true,
    interactive: false
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Key configurations

- `type: 'common'` declares a combination chart
- `series` configuration of the corresponding series
- `axes` declare angle axis and radius axis, note that axis information must be declared, otherwise, it cannot be drawn

### Easing function visualization

```javascript livedemo
const easingFuncs = {
  linear: function (k) {
    return k;
  },
  quadIn: function (k) {
    return k * k;
  },
  quadOut: function (k) {
    return k * (2 - k);
  },
  quadInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k;
    }
    return -0.5 * (--k * (k - 2) - 1);
  },
  cubicIn: function (k) {
    return k * k * k;
  },
  cubicOut: function (k) {
    return --k * k * k + 1;
  },
  cubicInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k * k;
    }
    return 0.5 * ((k -= 2) * k * k + 2);
  },
  quartIn: function (k) {
    return k * k * k * k;
  },
  quartOut: function (k) {
    return 1 - --k * k * k * k;
  },
  quartInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k * k * k;
    }
    return -0.5 * ((k -= 2) * k * k * k - 2);
  },
  quintIn: function (k) {
    return k * k * k * k * k;
  },
  quintOut: function (k) {
    return --k * k * k * k * k + 1;
  },
  quintInOut: function (k) {
    if ((k *= 2) < 1) {
      return 0.5 * k * k * k * k * k;
    }
    return 0.5 * ((k -= 2) * k * k * k * k + 2);
  },
  circIn: function (k) {
    return 1 - Math.sqrt(1 - k * k);
  },
  circOut: function (k) {
    return Math.sqrt(1 - --k * k);
  },
  circInOut: function (k) {
    if ((k *= 2) < 1) {
      return -0.5 * (Math.sqrt(1 - k * k) - 1);
    }
    return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
  },
  elasticIn: function (k) {
    let s;
    let a = 0.1;
    const p = 0.4;
    if (k === 0) {
      return 0;
    }
    if (k === 1) {
      return 1;
    }
    if (!a || a < 1) {
      a = 1;
      s = p / 4;
    } else {
      s = (p * Math.asin(1 / a)) / (2 * Math.PI);
    }
    return -(a * Math.pow(2, 10 * (k -= 1)) * Math.sin(((k - s) * (2 * Math.PI)) / p));
  },
  elasticOut: function (k) {
    let s;
    let a = 0.1;
    const p = 0.4;
    if (k === 0) {
      return 0;
    }
    if (k === 1) {
      return 1;
    }
    if (!a || a < 1) {
      a = 1;
      s = p / 4;
    } else {
      s = (p * Math.asin(1 / a)) / (2 * Math.PI);
    }
    return a * Math.pow(2, -10 * k) * Math.sin(((k - s) * (2 * Math.PI)) / p) + 1;
  },
  elasticInOut: function (k) {
    let s;
    let a = 0.1;
    const p = 0.4;
    if (k === 0) {
      return 0;
    }
    if (k === 1) {
      return 1;
    }
    if (!a || a < 1) {
      a = 1;
      s = p / 4;
    } else {
      s = (p * Math.asin(1 / a)) / (2 * Math.PI);
    }
    if ((k *= 2) < 1) {
      return -0.5 * (a * Math.pow(2, 10 * (k -= 1)) * Math.sin(((k - s) * (2 * Math.PI)) / p));
    }
    return a * Math.pow(2, -10 * (k -= 1)) * Math.sin(((k - s) * (2 * Math.PI)) / p) * 0.5 + 1;
  },
  backIn: function (k) {
    const s = 1.70158;
    return k * k * ((s + 1) * k - s);
  },
  backOut: function (k) {
    const s = 1.70158;
    return --k * k * ((s + 1) * k + s) + 1;
  },
  backInOut: function (k) {
    const s = 1.70158 * 1.525;
    if ((k *= 2) < 1) {
      return 0.5 * (k * k * ((s + 1) * k - s));
    }
    return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
  },
  bounceIn: function (k) {
    return 1 - easingFuncs.bounceOut(1 - k);
  },
  bounceOut: function (k) {
    if (k < 1 / 2.75) {
      return 7.5625 * k * k;
    } else if (k < 2 / 2.75) {
      return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
    } else if (k < 2.5 / 2.75) {
      return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
    }
    return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
  },
  bounceInOut: function (k) {
    if (k < 0.5) {
      return easingFuncs.bounceIn(k * 2) * 0.5;
    }
    return easingFuncs.bounceOut(k * 2 - 1) * 0.5 + 0.5;
  }
};

const POINTS = 30;
const row = 5;
const col = 5;
const region = [];
const layoutElements = [];
const series = [];
const axes = [];
const rowHeight = [];

Object.keys(easingFuncs).forEach((easingFuncName, index) => {
  const data = [];
  for (let i = 0; i < POINTS; i++) {
    data.push({
      x: i / POINTS,
      y: easingFuncs[easingFuncName](i / POINTS)
    });
  }

  region.push({
    id: easingFuncName
  });

  const seriesRow = Math.floor(index / col) + Math.floor(index / col);
  const seriesCol = index - Math.floor(index / col) * col;

  // 系列行
  layoutElements.push({
    row: seriesRow,
    col: seriesCol + seriesCol + 1,
    modelId: easingFuncName
  });

  series.push({
    id: `${easingFuncName}Series`,
    type: 'line',
    xField: 'x',
    yField: 'y',
    data: { id: easingFuncName, values: data },
    point: { style: { visible: false } },
    line: { style: { lineWidth: 2 } },
    regionId: easingFuncName,
    animationAppear: {
      easing: easingFuncName
    },
    extensionMark: [
      {
        type: 'text',
        style: {
          text: easingFuncName,
          x: 0,
          y: 0,
          fill: 'black',
          fontSize: 12,
          textAlign: 'left',
          textBaseline: 'top'
        }
      }
    ]
  });

  axes.push({
    id: `${easingFuncName}Left`,
    orient: 'left',
    visible: false,
    max: 1.5,
    regionId: easingFuncName,
    seriesId: [`${easingFuncName}Series`]
  });

  layoutElements.push({
    row: seriesRow,
    col: seriesCol + seriesCol,
    modelId: `${easingFuncName}Left`
  });

  axes.push({
    id: `${easingFuncName}Bottom`,
    orient: 'bottom',
    visible: false,
    regionId: easingFuncName,
    seriesId: [`${easingFuncName}Series`]
  });

  layoutElements.push({
    row: seriesRow + 1,
    col: seriesCol + seriesCol + 1,
    modelId: `${easingFuncName}Bottom`
  });

  if (seriesCol === 0) {
    rowHeight.push({
      index: seriesRow + 1,
      size: 10
    });
  }
});

const spec = {
  type: 'common',
  padding: {
    left: 30,
    right: 30
  },
  region,
  color: ['#6690F2', '#70D6A3', '#B4E6E2', '#63B5FC', '#FF8F62', '#FFDC83', '#BCC5FD', '#A29BFE'],
  layout: {
    type: 'grid',
    col: col * 2,
    row: row * 2,
    elements: layoutElements,
    rowHeight
  },
  axes,
  tooltip: false,
  series
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

#### Key configurations

- `type: 'common'` declares a combination chart type
- `layout` attribute configures the layout of multiple `regions`
- `animationAppear` entrance animation configuration
  - `animationAppear.easing` entrance animation easing function configuration

### Multi-region Pie Chart (Pie Chart + Pie Chart)

```javascript livedemo
const spec = {
  type: 'common',
  padding: {
    top: 10
  },
  layout: {
    type: 'grid',
    col: 1,
    row: 5,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        row: 4
      },
      {
        modelId: 'DAU',
        col: 0,
        row: 0
      },
      {
        modelId: 'new added',
        col: 0,
        row: 1
      },
      {
        modelId: 'MAU',
        col: 0,
        row: 2
      },
      {
        modelId: 'DAU/MAU',
        col: 0,
        row: 3
      }
    ]
  },
  region: [
    {
      id: 'DAU'
    },
    {
      id: 'new added'
    },
    {
      id: 'MAU'
    },
    {
      id: 'DAU/MAU'
    }
  ],
  legends: {
    padding: {
      top: 10
    },
    visible: true,
    orient: 'bottom',
    id: 'legend',
    regionId: ['DAU', 'new added', 'MAU', 'DAU/MAU'],
    item: {
      visible: true,
      background: {
        style: {
          fill: 'transparent'
        }
      }
    }
  },
  series: [
    {
      id: 'DAUseries0',
      regionId: 'DAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'DAU',
        values: [
          {
            type: 'front page',
            value: 120
          },
          {
            type: 'bi g',
            value: 100
          },
          {
            type: 'dashboard',
            value: 200
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },
    {
      id: 'new added series0',
      regionId: 'new added',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'new added',
        values: [
          {
            type: 'front page',
            value: 80
          },
          {
            type: 'big screen',
            value: 200
          },
          {
            type: 'dashboard',
            value: 400
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },
    {
      id: 'MAUseries0',
      regionId: 'MAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'MAU',
        values: [
          {
            type: 'front page',
            value: 123
          },
          {
            type: 'big screen',
            value: 245
          },
          {
            type: 'dashboard',
            value: 367
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },
    {
      id: 'DAU/MAUseries0',
      regionId: 'DAU/MAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'DAU/MAU',
        values: [
          {
            type: 'front page',
            value: 10
          },
          {
            type: 'big screen',
            value: 18
          },
          {
            type: 'dashboard',
            value: 8
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Key configurations

- `type: 'common'` declares a combination chart type
- `layout` attribute configures the layout of multiple `regions`
