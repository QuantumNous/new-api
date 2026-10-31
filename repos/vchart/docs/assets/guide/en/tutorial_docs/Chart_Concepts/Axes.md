# Axes

The axes in the chart are the basic elements used to represent the relationships between data. They help us better understand the data and guide us in reading and analyzing the chart. This tutorial mainly explains the related concepts and components of the axes. For more detailed configuration and examples of axes, please see the [Configuration Document](../../../option) and [Example](../../../example) pages.

## Components of Axes

According to different coordinate systems (currently, VChart supports Cartesian and polar coordinate systems), we can divide axes into:

1. X-axis and Y-axis in the Cartesian coordinate system

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a0f.png" alt="Axes in Cartesian coordinate system">
</div>

2. Radius axis and circular axis in the polar coordinate system

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a2c7623458257d1562627090f.png" alt="Axes in polar coordinate system">
</div>

Although the axes have different forms in different coordinate systems, the components of the axes are consistent, consisting of the following parts:

1. Axis title `title`
2. Axis line `domainLine`
3. Axis scale (including sub-scale line) `tick` & `subTick`
4. Axis label `label`
5. Grid lines (including sub-grid lines) `grid` & `subGrid`

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c610.png" alt="Diagram of the components of the axes in the Cartesian coordinate system">
</div>

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a211.png" alt="Diagram of the components of the axes in the polar coordinate system">
</div>

## Types of Axes

There are currently five types of axes supported in VChart:

1. Linear axis (type: 'linear'), suitable for numerical data;
2. Discrete axis (type: 'band'), suitable for discrete data;
3. Time axis (type: 'time'), suitable for representing time series data, for specific usage please refer to [SequenceChart Time Series Chart demo](/vchart/demo/sequence-chart/social-media-event);
   It should be noted that histograms do not support discrete axes, as histograms are used to count the frequency distribution of data intervals, and the main axis must be passed in as value intervals, which the discrete axis does not support.
4. Log axis (type: 'log'), the characteristic of the log axis is that the interval between the scales is calculated according to the logarithmic function (usually base 10). This means that each logarithmic unit (unit of size) of the data has the same physical length, e.g. from 1 to 10, 10 to 100, 100 to 1000, etc. For exponential growth or decline of data, the log axis can better show the relative change of data, the specific use can be viewed [log axis demo](/vchart/demo/axis/log-axis)
5. Symlog axis (type: 'symlog'), unlike the log axis, symlog can support negative numbers. For specific usage, the specific use can be viewed[symlog axis demo](/vchart/demo/axis/symlog-axis)

### Cartesian coordinate system axis configuration

In the Cartesian coordinate system, the X-axis defaults to type 'band', while the Y-axis defaults to type 'linear'. When `direction` is 'horizontal', X defaults to type 'linear', and Y-axis defaults to type 'band'.

For example:

In a normal Cartesian coordinate system, the X-axis is a discrete axis, and the Y-axis is a linear axis:

```ts
axes: [
  {
    type: 'band',
    orient: 'bottom' // Declare the display position
  },
  {
    type: 'linear',
    orient: 'left' // Declare the display position
  }
];
```

### Polar coordinate system axis configuration

In the polar coordinate system, the radius axis defaults to type 'linear', while the angle axis defaults to type 'band'.

```ts
axes: [
  {
    type: 'band',
    orient: 'angle' // Declare as circular axis
  },
  {
    type: 'linear',
    orient: 'radius' // Declare as radius axis
  }
];
```

## Axis range configuration

For linear axes (type: 'linear'/'time'/'log'/'symlog'), we provide the following properties for configuring the data range of the axes:

- `min`: configure the minimum value of the value axis, the priority is higher than `zero`, `nice`.
- `max`: Configure the maximum value of the value axis, the priority is higher than `zero`, `nice`.
- `nice`: Whether to adjust the axis range to a relatively regular value based on the data. For example, when max = 999 is configured, nice will not optimize the axis range. When min and max are configured, this configuration item becomes invalid. to 1000.
- `niceType`: Configure the type of nice effect, whether accuracy is priority or tickCount is priority (for example, if tickCount is 2, the accuracy of nice will be very low). If not configured, the default is tickCountFirst.
- `zero`: Whether to include 0 values. When min and max are configured, this configuration item becomes invalid.
- `expand`: The axis range is expanded proportionally, such as `expand: { min: 0.1, max: 0.1 }` When min and max are configured, this configuration item is invalid.

```ts
axes: [
  {
    orient: 'left',
    min: 100,
    max: 400
  }
];
```

For discrete axes (type: 'band'), we provide the following properties to configure the data range of the axis:

- `domain`: Configure the value range of the discrete axes.

```ts
axes: [
  {
    orient: 'bottom',
    domain: ['x', 'y', 'z']
  }
];
```

## axis tick configuration

The following configuration is provided on the axis `tick` attribute to control the display spacing, number, etc. of ticks.

- `tickStep` tick step size.
- `tickCount` is the recommended number of ticks and does not guarantee that the result will be the configured value.
- `forceTickCount` forces the number of ticks to be set to ensure that the number of ticks matches the set value, but the tick value may be a decimal due to the data range.
- `tickMode` continuous axis tick generation algorithm, supported since `1.3.0` version, only takes effect when the axis is a linear axis.
- `noDecimals` Whether to avoid decimal ticks, supported since version `1.3.0`, only takes effect when the axis is a linear axis.

```ts
axes: [
  {
    orient: 'left',
    tick: {
      tickCount: 5
    }
  }
];
```

## Axis label layout configuration

### Axis sampling `label.sampling`

By default, the axis labels enable the anti-overlapping label sampling capability, which is controlled by the `label.sampling` attribute of the axis in the corresponding direction on the `axes` attribute. The following figure shows the default display results when there are too many texts:

```javascript livedemo
const spec = {
  type: 'bar',

  xField: 'x',
  yField: 'y',
  axes: [
    {
      orient: 'bottom',
      sampling: false,
      label: {
        autoRotate: true,
        autoHide: true
      }
    }
  ],
  data: [
    {
      id: 'event_analysis_stack',
      values: [
        { x: '0', y: 28, c: 0 },
        { x: 0.5, y: 20, c: 1 },
        { x: 1, y: 43, c: 0 },
        { x: 1.5, y: 35, c: 1 },
        { x: 2, y: 81, c: 0 },
        { x: 2.5, y: 10, c: 1 },
        { x: 3, y: 19, c: 0 },
        { x: 3.5, y: 15, c: 1 },
        { x: 4, y: 52, c: 0 },
        { x: 4.5, y: 48, c: 1 },
        { x: 5, y: 24, c: 0 },
        { x: 5.5, y: 28, c: 1 },
        { x: 6, y: 87, c: 0 },
        { x: 6.5, y: 66, c: 1 },
        { x: 7, y: 17, c: 0 },
        { x: 7.5, y: 27, c: 1 },
        { x: 8, y: 68, c: 0 },
        { x: 8.5, y: 16, c: 1 },
        { x: 9, y: 49, c: 0 },
        { x: 9.5, y: 25, c: 1 },
        { x: 10, y: 28, c: 0 },
        { x: 10.5, y: 20, c: 1 },
        { x: 11, y: 43, c: 0 },
        { x: 11.5, y: 35, c: 1 },
        { x: 12, y: 81, c: 0 },
        { x: 12.5, y: 10, c: 1 },
        { x: 13, y: 19, c: 0 },
        { x: 13.5, y: 15, c: 1 },
        { x: 14, y: 52, c: 0 },
        { x: 14.5, y: 48, c: 1 },
        { x: 15, y: 24, c: 0 },
        { x: 15.5, y: 28, c: 1 },
        { x: 16, y: 87, c: 0 },
        { x: 16.5, y: 66, c: 1 },
        { x: 17, y: 17, c: 0 },
        { x: 17.5, y: 27, c: 1 },
        { x: 18, y: 68, c: 0 },
        { x: 18.5, y: 16, c: 1 },
        { x: 19, y: 49, c: 0 },
        { x: 19.5, y: 25, c: 1 },
        { x: 20, y: 28, c: 0 },
        { x: 20.5, y: 20, c: 1 },
        { x: 21, y: 43, c: 0 },
        { x: 21.5, y: 35, c: 1 },
        { x: 22, y: 81, c: 0 },
        { x: 22.5, y: 10, c: 1 },
        { x: 23, y: 19, c: 0 },
        { x: 23.5, y: 15, c: 1 },
        { x: 24, y: 52, c: 0 },
        { x: 24.5, y: 48, c: 1 },
        { x: 25, y: 24, c: 0 },
        { x: 25.5, y: 28, c: 1 },
        { x: 26, y: 87, c: 0 },
        { x: 26.5, y: 66, c: 1 },
        { x: 27, y: 17, c: 0 },
        { x: 27.5, y: 27, c: 1 },
        { x: 28, y: 68, c: 0 },
        { x: 28.5, y: 16, c: 1 },
        { x: 29, y: 49, c: 0 },
        { x: 29.5, y: 25, c: 1 },
        { x: 30, y: 28, c: 0 },
        { x: 30.5, y: 20, c: 1 },
        { x: 31, y: 43, c: 0 },
        { x: 31.5, y: 35, c: 1 },
        { x: 32, y: 81, c: 0 },
        { x: 32.5, y: 10, c: 1 },
        { x: 33, y: 19, c: 0 },
        { x: 33.5, y: 15, c: 1 },
        { x: 34, y: 52, c: 0 },
        { x: 34.5, y: 48, c: 1 },
        { x: 35, y: 24, c: 0 },
        { x: 35.5, y: 28, c: 1 },
        { x: 36, y: 87, c: 0 },
        { x: 36.5, y: 66, c: 1 },
        { x: 37, y: 17, c: 0 },
        { x: 37.5, y: 27, c: 1 },
        { x: 38, y: 68, c: 0 },
        { x: 38.5, y: 16, c: 1 },
        { x: 39, y: 49, c: 0 },
        { x: 39.5, y: 25, c: 1 }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

We can configure the spacing between labels via `label.minGap`.

### Label layout for the axis component

The axis component itself also provides some layout strategies for axis labels, including:

- `autoHide` automatically hides
- `autoRotate` auto-rotate
- `autoLimit` is automatically omitted

These are all turned off by default. By default, we use the axis sampling layout strategy to prevent overlapping of axis labels, because the axis sampling algorithm performs sampling at the data level, and then draws the coordinate axis components, which has better performance in comparison. So when you need to use the label layout strategy of the axis component, you need to manually enable it.

The following figure shows the effect of configuring `autoHide` and `autoRotate` on the x-axis label after turning off the axis sampling:

```javascript livedemo
const spec = {
  type: 'bar',

  xField: 'x',
  yField: 'y',
  axes: [
    {
      orient: 'bottom',
      sampling: false,
      label: {
        autoRotate: true,
        autoHide: true
      }
    }
  ],
  data: [
    {
      id: 'event_analysis_stack',
      values: [
        { x: '0', y: 28, c: 0 },
        { x: 0.5, y: 20, c: 1 },
        { x: 1, y: 43, c: 0 },
        { x: 1.5, y: 35, c: 1 },
        { x: 2, y: 81, c: 0 },
        { x: 2.5, y: 10, c: 1 },
        { x: 3, y: 19, c: 0 },
        { x: 3.5, y: 15, c: 1 },
        { x: 4, y: 52, c: 0 },
        { x: 4.5, y: 48, c: 1 },
        { x: 5, y: 24, c: 0 },
        { x: 5.5, y: 28, c: 1 },
        { x: 6, y: 87, c: 0 },
        { x: 6.5, y: 66, c: 1 },
        { x: 7, y: 17, c: 0 },
        { x: 7.5, y: 27, c: 1 },
        { x: 8, y: 68, c: 0 },
        { x: 8.5, y: 16, c: 1 },
        { x: 9, y: 49, c: 0 },
        { x: 9.5, y: 25, c: 1 },
        { x: 10, y: 28, c: 0 },
        { x: 10.5, y: 20, c: 1 },
        { x: 11, y: 43, c: 0 },
        { x: 11.5, y: 35, c: 1 },
        { x: 12, y: 81, c: 0 },
        { x: 12.5, y: 10, c: 1 },
        { x: 13, y: 19, c: 0 },
        { x: 13.5, y: 15, c: 1 },
        { x: 14, y: 52, c: 0 },
        { x: 14.5, y: 48, c: 1 },
        { x: 15, y: 24, c: 0 },
        { x: 15.5, y: 28, c: 1 },
        { x: 16, y: 87, c: 0 },
        { x: 16.5, y: 66, c: 1 },
        { x: 17, y: 17, c: 0 },
        { x: 17.5, y: 27, c: 1 },
        { x: 18, y: 68, c: 0 },
        { x: 18.5, y: 16, c: 1 },
        { x: 19, y: 49, c: 0 },
        { x: 19.5, y: 25, c: 1 },
        { x: 20, y: 28, c: 0 },
        { x: 20.5, y: 20, c: 1 },
        { x: 21, y: 43, c: 0 },
        { x: 21.5, y: 35, c: 1 },
        { x: 22, y: 81, c: 0 },
        { x: 22.5, y: 10, c: 1 },
        { x: 23, y: 19, c: 0 },
        { x: 23.5, y: 15, c: 1 },
        { x: 24, y: 52, c: 0 },
        { x: 24.5, y: 48, c: 1 },
        { x: 25, y: 24, c: 0 },
        { x: 25.5, y: 28, c: 1 },
        { x: 26, y: 87, c: 0 },
        { x: 26.5, y: 66, c: 1 },
        { x: 27, y: 17, c: 0 },
        { x: 27.5, y: 27, c: 1 },
        { x: 28, y: 68, c: 0 },
        { x: 28.5, y: 16, c: 1 },
        { x: 29, y: 49, c: 0 },
        { x: 29.5, y: 25, c: 1 },
        { x: 30, y: 28, c: 0 },
        { x: 30.5, y: 20, c: 1 },
        { x: 31, y: 43, c: 0 },
        { x: 31.5, y: 35, c: 1 },
        { x: 32, y: 81, c: 0 },
        { x: 32.5, y: 10, c: 1 },
        { x: 33, y: 19, c: 0 },
        { x: 33.5, y: 15, c: 1 },
        { x: 34, y: 52, c: 0 },
        { x: 34.5, y: 48, c: 1 },
        { x: 35, y: 24, c: 0 },
        { x: 35.5, y: 28, c: 1 },
        { x: 36, y: 87, c: 0 },
        { x: 36.5, y: 66, c: 1 },
        { x: 37, y: 17, c: 0 },
        { x: 37.5, y: 27, c: 1 },
        { x: 38, y: 68, c: 0 },
        { x: 38.5, y: 16, c: 1 },
        { x: 39, y: 49, c: 0 },
        { x: 39.5, y: 25, c: 1 }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

We also provide other demos on axis label layout:

- [Turn off axis label sampling & dataFilter](/vchart/demo/axis/disable-sampling)
- [The first and last text of the coordinate axis shrink inwards](/vchart/demo/axis/flush)
- [Axis text auto-hide](/vchart/demo/axis/axis-label-autoHide)
- [Axis Text Auto Rotate](/vchart/demo/axis/axis-label-autoRotate)
- [Axis text is automatically omitted](/vchart/demo/axis/axis-label-autoLimit)

## Drawing multiple axes

In some cases, multiple axes may need to be drawn in the chart. We only need to add the axis configuration to the `axes` property as needed.

For example, in the following case, in the Cartesian coordinate system, we draw a double Y-axis, and we only need to make the following declarations:

```ts
axes: [
  {
    type: 'linear', // Declare the axis type
    orient: 'left' // Declare the axis display position
  },
  {
    type: 'linear', // Declare the axis type
    orient: 'right' // Declare the axis display position
  }
];
```

```javascript livedemo
const spec = {
  type: 'area',
  data: [
    {
      id: 'area',
      values: [
        { x: '1990', y: 110, from: 'vi de po' },
        { x: '1995', y: 160, from: 'video' },
        { x: '2000', y: 230, from: 'video a d' },
        { x: '2005', y: 300, from: 'video ad' },
        { x: '2010', y: 448, from: 'video ad' },
        { x: '2015', y: 500, from: 'video ad' },
        { x: '1990', y: 120, from: 'email marketing' },
        { x: '1995', y: 150, from: 'email marketing' },
        { x: '2000', y: 200, from: 'email marketing' },
        { x: '2005', y: 210, from: 'email marketing' },
        { x: '2010', y: 300, from: 'email marketing' },
        { x: '2015', y: 320, from: 'email marketing' }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'from',
  axes: [
    {
      orient: 'bottom'
    },
    {
      orient: 'left',
      type: 'linear'
    },
    {
      orient: 'right',
      type: 'linear'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### Axis and series binding

In multi-series scenarios, we often expect to bind axes to different series. For example, in a dual-axis chart, we expect the left and right axes to correspond to different series.

In VChart, you can configure the axis with the ID of the chart series or the serial number of the series for binding.

```ts
{
  series: [
    {
      type: 'bar',
      id: 'bar0',
    },{
      type: 'line',
      id: 'line0',
    },
  ],
  axes: [
    {
      type: 'linear', // Declare the axis type
      orient: 'left', // Declare the axis display position
      seriesId: ['bar0'] // Declare axis bound series
    },
    {
      type: 'linear', // Declare the axis type
      orient: 'right', // Declare the axis display position
      seriesIndex: [1, 2] // Declare axis bound series
    }
  ]
}
```

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'data0',
      values: [
        { x: 'Monday', type: 'Breakfast', y: 15 },
        { x: 'Monday', type: 'Lunch', y: 25 },
        { x: 'Tuesday', type: 'Breakfast', y: 12 },
        { x: 'Tuesday', type: 'Lunch', y: 30 },
        { x: 'Wednesday', type: 'Breakfast', y: 15 },
        { x: 'Wednesday', type: 'Lunch', y: 24 },
        { x: 'Thursday', type: 'Breakfast', y: 10 },
        { x: 'Thursday', type: 'Lunch', y: 25 },
        { x: 'Friday', type: 'Breakfast', y: 13 },
        { x: 'Friday', type: 'Lunch', y: 20 },
        { x: 'Saturday', type: 'Breakfast', y: 10 },
        { x: 'Saturday', type: 'Lunch', y: 22 },
        { x: 'Sunday', type: 'Breakfast', y: 12 },
        { x: 'Sunday', type: 'Lunch', y: 19 }
      ]
    },
    {
      id: 'data1',
      values: [
        { x: 'Monday', type: 'Wine', y: 22 },
        { x: 'Tuesday', type: 'Wine', y: 23 },
        { x: 'Wednesday', type: 'Wine', y: 13 },
        { x: 'Thursday', type: 'Wine', y: 12 },
        { x: 'Friday', type: 'Wine', y: 10 },
        { x: 'Saturday', type: 'Wine', y: 20 },
        { x: 'Sunday', type: 'Wine', y: 10 }
      ]
    },
    {
      id: 'data2',
      values: [
        { x: 'Monday', type: 'Beverages', y: 132 },
        { x: 'Tuesday', type: 'Beverages', y: 143 },
        { x: 'Wednesday', type: 'Beverages', y: 143 },
        { x: 'Thursday', type: 'Beverages', y: 132 },
        { x: 'Friday', type: 'Beverages', y: 130 },
        { x: 'Saturday', type: 'Beverages', y: 130 },
        { x: 'Sunday', type: 'Beverages', y: 150 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar0',
      dataIndex: 0,
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line0',
      dataId: 'data1',
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    },
    {
      type: 'line',
      id: 'line1',
      dataId: 'data2',
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesId: ['bar0'] },
    { orient: 'right', seriesIndex: [1, 2] },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### Multi-axis synchronization

We provide `sync` configuration for multiple axes, which can be used to configure 0 value alignment or tick proportional alignment of multiple axes.

```ts
export interface ILinearAxisSync {
  /**
   * 配置参照的轴 id
   */
  axisId: StringOrNumber;
  /**
   * 是否保持 2 个轴的 0 值对齐
   * @default false
   */
  zeroAlign?: boolean;
  /**
   * 是否使这个轴的 tick 与目标轴保持比例对齐
   * @default false
   */
  tickAlign?: boolean;
}
```

#### 0 value alignment for 2 axes

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', y: 15 },
        { x: 'Tuesday', y: 12 },
        { x: 'Wednesday', y: 15 },
        { x: 'Thursday', y: 10 },
        { x: 'Friday', y: 13 },
        { x: 'Saturday', y: 10 },
        { x: 'Sunday', y: 20 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', y: -52 },
        { x: 'Tuesday', y: -43 },
        { x: 'Wednesday', y: -33 },
        { x: 'Thursday', y: -22 },
        { x: 'Friday', y: -10 },
        { x: 'Saturday', y: -30 },
        { x: 'Sunday', y: -50 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      stack: false,
      label: { visible: true },
      xField: 'x',
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
    { orient: 'left', seriesIndex: [0], id: 'axisLeft', nice: false, zero: false },
    {
      orient: 'right',
      seriesId: ['line'],
      grid: { visible: false },
      nice: false,
      zero: false,
      sync: { axisId: 'axisLeft', zeroAlign: true }
    },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Keep the ticks of the two axes aligned proportionally

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', y: 15 },
        { x: 'Tuesday', y: 12 },
        { x: 'Wednesday', y: 15 },
        { x: 'Thursday', y: 10 },
        { x: 'Friday', y: 13 },
        { x: 'Saturday', y: 10 },
        { x: 'Sunday', y: 20 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', y: -52 },
        { x: 'Tuesday', y: -43 },
        { x: 'Wednesday', y: -33 },
        { x: 'Thursday', y: -22 },
        { x: 'Friday', y: -10 },
        { x: 'Saturday', y: -30 },
        { x: 'Sunday', y: -50 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      stack: false,
      label: { visible: true },
      xField: 'x',
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
    { orient: 'left', seriesIndex: [0], id: 'axisLeft', nice: false, zero: false },
    {
      orient: 'right',
      seriesId: ['line'],
      grid: { visible: false },
      nice: false,
      zero: false,
      sync: { axisId: 'axisLeft', tickAlign: true }
    },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Examples

For more examples, see: [Axis Example](https://www.visactor.io/vchart/example#axis)

### 0 Tick axis line configuration

In the Cartesian coordinate system, when the numerical axis has positive and negative values, the X-axis line can be displayed on the Y-axis 0 tick by configuring `domainLine.onZero`.

```javascript livedemo
const data = [
  { full_name: 'Alexandria Ocasio-Cortez', gender: 'F', birth: 1989 },
  { full_name: 'Abby Finkenauer', gender: 'F', birth: 1988 },
  { full_name: 'Katie Hill', gender: 'F', birth: 1987 },
  { full_name: 'Josh Harder', gender: 'M', birth: 1986 },
  { full_name: 'Lauren Underwood', gender: 'F', birth: 1986 },
  { full_name: 'Max Rose', gender: 'M', birth: 1986 },
  { full_name: 'Elise M. Stefanik', gender: 'F', birth: 1984 },
  { full_name: 'Mike Gallagher', gender: 'M', birth: 1984 },
  { full_name: 'Conor Lamb', gender: 'M', birth: 1984 },
  { full_name: 'Joe Neguse', gender: 'M', birth: 1984 },
  { full_name: 'Xochitl Torres Small', gender: 'F', birth: 1984 },
  { full_name: 'Anthony Gonzalez', gender: 'M', birth: 1984 },
  { full_name: 'William R. Timmons IV', gender: 'M', birth: 1984 },
  { full_name: 'Dan Crenshaw', gender: 'M', birth: 1984 },
  { full_name: 'Patrick Murphy', gender: 'M', birth: 1983 },
  { full_name: 'Trey Hollingsworth', gender: 'M', birth: 1983 },
  { full_name: 'Haley M. Stevens', gender: 'F', birth: 1983 },
  { full_name: 'Guy Reschenthaler', gender: 'M', birth: 1983 },
  { full_name: 'Colin Z. Allred', gender: 'M', birth: 1983 },
  { full_name: 'Matt Gaetz', gender: 'M', birth: 1982 },
  { full_name: 'Andy Kim', gender: 'M', birth: 1982 },
  { full_name: 'Joe Cunningham', gender: 'M', birth: 1982 },
  { full_name: 'Lance Gooden', gender: 'M', birth: 1982 },
  { full_name: 'Jared F. Golden', gender: 'M', birth: 1982 },
  { full_name: 'Aaron Schock', gender: 'M', birth: 1981 },
  { full_name: 'Tulsi Gabbard', gender: 'F', birth: 1981 },
  { full_name: 'Michael F. Q. San Nicolas', gender: 'M', birth: 1981 },
  { full_name: 'Ilhan Omar', gender: 'F', birth: 1981 },
  { full_name: 'Bryan Steil', gender: 'M', birth: 1981 },
  { full_name: 'Carlos Curbelo', gender: 'M', birth: 1980 },
  { full_name: 'Ruben J. Kihuen', gender: 'M', birth: 1980 },
  { full_name: 'Justin Amash', gender: 'M', birth: 1980 },
  { full_name: 'Eric Swalwell', gender: 'M', birth: 1980 },
  { full_name: 'Joseph P. Kennedy III', gender: 'M', birth: 1980 },
  { full_name: 'Jason Smith', gender: 'M', birth: 1980 },
  { full_name: 'Lee M. Zeldin', gender: 'M', birth: 1980 },
  { full_name: 'Brian J. Mast', gender: 'M', birth: 1980 },
  { full_name: 'Sharice Davids', gender: 'F', birth: 1980 },
  { full_name: 'Chris Pappas', gender: 'M', birth: 1980 },
  { full_name: 'Scott Taylor', gender: 'M', birth: 1979 },
  { full_name: 'Ruben Gallego', gender: 'M', birth: 1979 },
  { full_name: 'Pete Aguilar', gender: 'M', birth: 1979 },
  { full_name: 'Jim Banks', gender: 'M', birth: 1979 },
  { full_name: 'Jason Crow', gender: 'M', birth: 1979 },
  { full_name: 'Abigail Davis Spanberger', gender: 'F', birth: 1979 },
  { full_name: 'Josh Hawley', gender: 'M', birth: 1979 },
  { full_name: 'Ron DeSantis', gender: 'M', birth: 1978 },
  { full_name: 'Jaime Herrera Beutler', gender: 'F', birth: 1978 },
  { full_name: 'Adam Kinzinger', gender: 'M', birth: 1978 },
  { full_name: 'Seth Moulton', gender: 'M', birth: 1978 },
  { full_name: 'Stephanie N. Murphy', gender: 'F', birth: 1978 },
  { full_name: 'Darren Soto', gender: 'M', birth: 1978 },
  { full_name: 'Mike Levin', gender: 'M', birth: 1978 },
  { full_name: 'W. Gregory Steube', gender: 'M', birth: 1978 },
  { full_name: 'Anthony Brindisi', gender: 'M', birth: 1978 },
  { full_name: 'David G. Valadao', gender: 'M', birth: 1977 },
  { full_name: 'Tom Cotton', gender: 'M', birth: 1977 },
  { full_name: 'Markwayne Mullin', gender: 'M', birth: 1977 },
  { full_name: 'Brendan F. Boyle', gender: 'M', birth: 1977 },
  { full_name: 'Will Hurd', gender: 'M', birth: 1977 },
  { full_name: 'Antonio Delgado', gender: 'M', birth: 1977 },
  { full_name: 'Benjamin Quayle', gender: 'M', birth: 1976 },
  { full_name: 'Trey Radel', gender: 'M', birth: 1976 },
  { full_name: 'Marlin A. Stutzman', gender: 'M', birth: 1976 },
  { full_name: 'Kevin Yoder', gender: 'M', birth: 1976 },
  { full_name: 'Ryan A. Costello', gender: 'M', birth: 1976 },
  { full_name: 'Duncan Hunter', gender: 'M', birth: 1976 },
  { full_name: 'Martha Roby', gender: 'F', birth: 1976 },
  { full_name: 'Kyrsten Sinema', gender: 'F', birth: 1976 },
  { full_name: 'Ro Khanna', gender: 'M', birth: 1976 },
  { full_name: 'Nanette Diaz Barragán', gender: 'F', birth: 1976 },
  { full_name: 'Jenniffer González-Colón', gender: 'F', birth: 1976 },
  { full_name: 'Steve Watkins', gender: 'M', birth: 1976 },
  { full_name: 'Elissa Slotkin', gender: 'F', birth: 1976 },
  { full_name: 'Rashida Tlaib', gender: 'F', birth: 1976 },
  { full_name: 'Kelly Armstrong', gender: 'M', birth: 1976 },
  { full_name: 'Kendra S. Horn', gender: 'F', birth: 1976 },
  { full_name: 'Dusty Johnson', gender: 'M', birth: 1976 },
  { full_name: 'Mike Garcia', gender: 'M', birth: 1976 },
  { full_name: 'Jim Bridenstine', gender: 'M', birth: 1975 },
  { full_name: 'Jared Polis', gender: 'M', birth: 1975 },
  { full_name: 'Mia B. Love', gender: 'F', birth: 1975 },
  { full_name: 'Patrick T. McHenry', gender: 'M', birth: 1975 },
  { full_name: 'Grace Meng', gender: 'F', birth: 1975 },
  { full_name: 'Josh Gottheimer', gender: 'M', birth: 1975 },
  { full_name: 'Michael Cloud', gender: 'M', birth: 1975 },
  { full_name: 'Lizzie Fletcher', gender: 'F', birth: 1975 },
  { full_name: 'Elaine G. Luria', gender: 'F', birth: 1975 },
  { full_name: 'Vance M. McAllister', gender: 'M', birth: 1974 },
  { full_name: 'André Carson', gender: 'M', birth: 1974 },
  { full_name: 'Cory Gardner', gender: 'M', birth: 1974 },
  { full_name: 'Joaquin Castro', gender: 'M', birth: 1974 },
  { full_name: 'Derek Kilmer', gender: 'M', birth: 1974 },
  { full_name: 'Jimmy Gomez', gender: 'M', birth: 1974 },
  { full_name: 'Katie Porter', gender: 'F', birth: 1974 },
  { full_name: 'Michael Waltz', gender: 'M', birth: 1974 },
  { full_name: 'Ayanna Pressley', gender: 'F', birth: 1974 },
  { full_name: 'Ben McAdams', gender: 'M', birth: 1974 },
  { full_name: 'Dan Boren', gender: 'M', birth: 1973 },
  { full_name: 'Jon Runyan', gender: 'M', birth: 1973 },
  { full_name: 'Stephen Lee Fincher', gender: 'M', birth: 1973 },
  { full_name: 'Christopher Murphy', gender: 'M', birth: 1973 },
  { full_name: 'Devin Nunes', gender: 'M', birth: 1973 },
  { full_name: 'Cedric L. Richmond', gender: 'M', birth: 1973 },
  { full_name: 'Tim Ryan', gender: 'M', birth: 1973 },
  { full_name: 'Andy Barr', gender: 'M', birth: 1973 },
  { full_name: 'Raja Krishnamoorthi', gender: 'M', birth: 1973 },
  { full_name: 'Brian K. Fitzpatrick', gender: 'M', birth: 1973 },
  { full_name: 'Steven Horsford', gender: 'M', birth: 1973 },
  { full_name: 'Jahana Hayes', gender: 'F', birth: 1973 },
  { full_name: 'Russ Fulcher', gender: 'M', birth: 1973 },
  { full_name: 'Lori Trahan', gender: 'F', birth: 1973 },
  { full_name: 'David W. Jolly', gender: 'M', birth: 1972 },
  { full_name: 'Beto O’Rourke', gender: 'M', birth: 1972 },
  { full_name: 'Thomas A. Garrett, Jr.', gender: 'M', birth: 1972 },
  { full_name: 'Ben Ray Luján', gender: 'M', birth: 1972 },
  { full_name: 'Todd Young', gender: 'M', birth: 1972 },
  { full_name: 'Brian Schatz', gender: 'M', birth: 1972 },
  { full_name: 'Raul Ruiz', gender: 'M', birth: 1972 },
  { full_name: 'Garret Graves', gender: 'M', birth: 1972 },
  { full_name: 'David Rouzer', gender: 'M', birth: 1972 },
  { full_name: 'Ben Sasse', gender: 'M', birth: 1972 },
  { full_name: 'James Comer', gender: 'M', birth: 1972 },
  { full_name: 'Mike Johnson', gender: 'M', birth: 1972 },
  { full_name: 'Jodey C. Arrington', gender: 'M', birth: 1972 },
  { full_name: 'Angie Craig', gender: 'F', birth: 1972 },
  { full_name: 'Mikie Sherrill', gender: 'F', birth: 1972 },
  { full_name: 'Van Taylor', gender: 'M', birth: 1972 },
  { full_name: 'Chip Roy', gender: 'M', birth: 1972 },
  { full_name: 'Ben Cline', gender: 'M', birth: 1972 },
  { full_name: 'Heath Shuler', gender: 'M', birth: 1971 },
  { full_name: 'Kristi L. Noem', gender: 'F', birth: 1971 },
  { full_name: 'Sean P. Duffy', gender: 'M', birth: 1971 },
  { full_name: 'Martin Heinrich', gender: 'M', birth: 1971 },
  { full_name: 'Mike Lee', gender: 'M', birth: 1971 },
  { full_name: 'Tom Reed', gender: 'M', birth: 1971 },
  { full_name: 'Marco Rubio', gender: 'M', birth: 1971 },
  { full_name: 'Thomas Massie', gender: 'M', birth: 1971 },
  { full_name: 'Richard Hudson', gender: 'M', birth: 1971 },
  { full_name: 'Marc A. Veasey', gender: 'M', birth: 1971 },
  { full_name: 'Alexander X. Mooney', gender: 'M', birth: 1971 },
  { full_name: 'Ted Budd', gender: 'M', birth: 1971 },
  { full_name: 'Gilbert Ray Cisneros, Jr.', gender: 'M', birth: 1971 },
  { full_name: 'Debbie Mucarsel-Powell', gender: 'F', birth: 1971 },
  { full_name: 'Sean Casten', gender: 'M', birth: 1971 },
  { full_name: 'Jeffrey M. Landry', gender: 'M', birth: 1970 },
  { full_name: 'Michael G. Grimm', gender: 'M', birth: 1970 },
  { full_name: 'Frank C. Guinta', gender: 'M', birth: 1970 },
  { full_name: 'Todd Rokita', gender: 'M', birth: 1970 },
  { full_name: 'Thomas J. Rooney', gender: 'M', birth: 1970 },
  { full_name: 'Paul D. Ryan', gender: 'M', birth: 1970 },
  { full_name: 'Tom Graves', gender: 'M', birth: 1970 },
  { full_name: 'Steven M. Palazzo', gender: 'M', birth: 1970 },
  { full_name: 'Adrian Smith', gender: 'M', birth: 1970 },
  { full_name: 'Rob Woodall', gender: 'M', birth: 1970 },
  { full_name: 'Rodney Davis', gender: 'M', birth: 1970 },
  { full_name: 'Hakeem S. Jeffries', gender: 'M', birth: 1970 },
  { full_name: 'Ted Cruz', gender: 'M', birth: 1970 },
  { full_name: 'Joni Ernst', gender: 'F', birth: 1970 },
  { full_name: 'Warren Davidson', gender: 'M', birth: 1970 },
  { full_name: 'Greg Stanton', gender: 'M', birth: 1970 },
  { full_name: 'Michael Guest', gender: 'M', birth: 1970 },
  { full_name: 'Denver Riggleman', gender: 'M', birth: 1970 },
  { full_name: 'Kelly Loeffler', gender: 'F', birth: 1970 },
  { full_name: 'William M. Cowan', gender: 'M', birth: 1969 },
  { full_name: 'Robert Hurt', gender: 'M', birth: 1969 },
  { full_name: 'Robert J. Dold', gender: 'M', birth: 1969 },
  { full_name: 'Luke Messer', gender: 'M', birth: 1969 },
  { full_name: 'Bill Huizenga', gender: 'M', birth: 1969 },
  { full_name: 'Cathy McMorris Rodgers', gender: 'F', birth: 1969 },
  { full_name: 'Austin Scott', gender: 'M', birth: 1969 },
  { full_name: 'Linda T. Sánchez', gender: 'F', birth: 1969 },
  { full_name: 'Cory A. Booker', gender: 'M', birth: 1969 },
  { full_name: 'Ted Lieu', gender: 'M', birth: 1969 },
  { full_name: 'Mark Walker', gender: 'M', birth: 1969 },
  { full_name: 'Jimmy Panetta', gender: 'M', birth: 1969 },
  { full_name: 'Dean Phillips', gender: 'M', birth: 1969 },
  { full_name: 'Veronica Escobar', gender: 'F', birth: 1969 },
  { full_name: 'Jason Altmire', gender: 'M', birth: 1968 },
  { full_name: 'Tim Griffin', gender: 'M', birth: 1968 },
  { full_name: 'Daniel B. Maffei', gender: 'M', birth: 1968 },
  { full_name: 'Kelly Ayotte', gender: 'F', birth: 1968 },
  { full_name: 'Tim Huelskamp', gender: 'M', birth: 1968 },
  { full_name: 'David Young', gender: 'M', birth: 1968 },
  { full_name: 'James Lankford', gender: 'M', birth: 1968 },
  { full_name: 'Tammy Duckworth', gender: 'F', birth: 1968 },
  { full_name: 'George Holding', gender: 'M', birth: 1968 },
  { full_name: 'Darin LaHood', gender: 'M', birth: 1968 },
  { full_name: 'Jennifer Wexton', gender: 'F', birth: 1968 },
  { full_name: 'Kim Schrier', gender: 'F', birth: 1968 },
  { full_name: 'Connie Mack', gender: 'M', birth: 1967 },
  { full_name: 'Mark Takai', gender: 'M', birth: 1967 },
  { full_name: 'Mick Mulvaney', gender: 'M', birth: 1967 },
  { full_name: 'Jason Chaffetz', gender: 'M', birth: 1967 },
  { full_name: 'Jeff Denham', gender: 'M', birth: 1967 },
  { full_name: 'Raúl R. Labrador', gender: 'M', birth: 1967 },
  { full_name: 'Mike Bishop', gender: 'M', birth: 1967 },
  { full_name: 'Bruce Westerman', gender: 'M', birth: 1967 },
  { full_name: 'Vicente Gonzalez', gender: 'M', birth: 1967 },
  { full_name: 'Chrissy Houlahan', gender: 'F', birth: 1967 },
  { full_name: 'Randy Hultgren', gender: 'M', birth: 1966 },
  { full_name: 'Stephen Knight', gender: 'M', birth: 1966 },
  { full_name: 'Kirsten E. Gillibrand', gender: 'F', birth: 1966 },
  { full_name: 'Kathy Castor', gender: 'F', birth: 1966 },
  { full_name: 'Eric A. "Rick" Crawford', gender: 'M', birth: 1966 },
  { full_name: 'Theodore E. Deutch', gender: 'M', birth: 1966 },
  { full_name: 'Jeff Duncan', gender: 'M', birth: 1966 },
  { full_name: 'James A. Himes', gender: 'M', birth: 1966 },
  { full_name: 'Daniel Lipinski', gender: 'M', birth: 1966 },
  { full_name: 'Debbie Wasserman Schultz', gender: 'F', birth: 1966 },
  { full_name: 'Doug Collins', gender: 'M', birth: 1966 },
  { full_name: 'Sean Patrick Maloney', gender: 'M', birth: 1966 },
  { full_name: 'Stacey E. Plaskett', gender: 'F', birth: 1966 },
  { full_name: 'Trent Kelly', gender: 'M', birth: 1966 },
  { full_name: 'A. Drew Ferguson IV', gender: 'M', birth: 1966 },
  { full_name: 'David Kustoff', gender: 'M', birth: 1966 },
  { full_name: 'Liz Cheney', gender: 'F', birth: 1966 },
  { full_name: 'Ross Spano', gender: 'M', birth: 1966 },
  { full_name: 'Pete Stauber', gender: 'M', birth: 1966 },
  { full_name: 'Susie Lee', gender: 'F', birth: 1966 },
  { full_name: 'Martha McSally', gender: 'F', birth: 1966 },
  { full_name: 'Chris Jacobs', gender: 'M', birth: 1966 },
  { full_name: 'Jesse L. Jackson Jr.', gender: 'M', birth: 1965 },
  { full_name: 'David Rivera', gender: 'M', birth: 1965 },
  { full_name: 'John Sullivan', gender: 'M', birth: 1965 },
  { full_name: 'Jeff Chiesa', gender: 'M', birth: 1965 },
  { full_name: 'Steve Southerland II', gender: 'M', birth: 1965 },
  { full_name: 'Erik Paulsen', gender: 'M', birth: 1965 },
  { full_name: 'John Ratcliffe', gender: 'M', birth: 1965 },
  { full_name: 'Robert B. Aderholt', gender: 'M', birth: 1965 },
  { full_name: 'Rick Larsen', gender: 'M', birth: 1965 },
  { full_name: 'Kevin McCarthy', gender: 'M', birth: 1965 },
  { full_name: 'Steve Scalise', gender: 'M', birth: 1965 },
  { full_name: 'Tim Scott', gender: 'M', birth: 1965 },
  { full_name: 'Terri A. Sewell', gender: 'F', birth: 1965 },
  { full_name: 'Adam Smith', gender: 'M', birth: 1965 },
  { full_name: 'Steve Stivers', gender: 'M', birth: 1965 },
  { full_name: 'Ami Bera', gender: 'M', birth: 1965 },
  { full_name: 'Norma J. Torres', gender: 'F', birth: 1965 },
  { full_name: 'Kathleen M. Rice', gender: 'F', birth: 1965 },
  { full_name: 'Pramila Jayapal', gender: 'F', birth: 1965 },
  { full_name: 'Cynthia Axne', gender: 'F', birth: 1965 },
  { full_name: 'Tom Malinowski', gender: 'M', birth: 1965 },
  { full_name: 'John W. Rose', gender: 'M', birth: 1965 },
  { full_name: 'Fred Keller', gender: 'M', birth: 1965 },
  { full_name: 'Robert T. Schilling', gender: 'M', birth: 1964 },
  { full_name: 'Renee L. Ellmers', gender: 'F', birth: 1964 },
  { full_name: 'Christopher P. Gibson', gender: 'M', birth: 1964 },
  { full_name: 'Trey Gowdy', gender: 'M', birth: 1964 },
  { full_name: 'Timothy J. Walz', gender: 'M', birth: 1964 },
  { full_name: 'Dave Brat', gender: 'M', birth: 1964 },
  { full_name: 'Michael F. Bennet', gender: 'M', birth: 1964 },
  { full_name: 'Yvette D. Clarke', gender: 'F', birth: 1964 },
  { full_name: 'Scott DesJarlais', gender: 'M', birth: 1964 },
  { full_name: 'Brett Guthrie', gender: 'M', birth: 1964 },
  { full_name: 'Jim Jordan', gender: 'M', birth: 1964 },
  { full_name: 'James R. Langevin', gender: 'M', birth: 1964 },
  { full_name: 'Jared Huffman', gender: 'M', birth: 1964 },
  { full_name: 'Mark Pocan', gender: 'M', birth: 1964 },
  { full_name: 'Dan Sullivan', gender: 'M', birth: 1964 },
  { full_name: 'Kamala D. Harris', gender: 'F', birth: 1964 },
  { full_name: 'Catherine Cortez Masto', gender: 'F', birth: 1964 },
  { full_name: 'Salud O. Carbajal', gender: 'M', birth: 1964 },
  { full_name: 'Lloyd Smucker', gender: 'M', birth: 1964 },
  { full_name: 'Daniel Meuser', gender: 'M', birth: 1964 },
  { full_name: 'Tim Burchett', gender: 'M', birth: 1964 },
  { full_name: 'Mark E. Green', gender: 'M', birth: 1964 },
  { full_name: 'Dan Bishop', gender: 'M', birth: 1964 },
  { full_name: 'Betty Sutton', gender: 'F', birth: 1963 },
  { full_name: 'Eric Cantor', gender: 'M', birth: 1963 },
  { full_name: 'Mark L. Pryor', gender: 'M', birth: 1963 },
  { full_name: 'Mike Rogers', gender: 'M', birth: 1963 },
  { full_name: 'Joe Garcia', gender: 'M', birth: 1963 },
  { full_name: 'Michael G. Fitzpatrick', gender: 'M', birth: 1963 },
  { full_name: 'Gwen Graham', gender: 'F', birth: 1963 },
  { full_name: 'Mike Pompeo', gender: 'M', birth: 1963 },
  { full_name: 'Keith Ellison', gender: 'M', birth: 1963 },
  { full_name: 'Lynn Jenkins', gender: 'F', birth: 1963 },
  { full_name: 'John K. Delaney', gender: 'M', birth: 1963 },
  { full_name: 'Steve Russell', gender: 'M', birth: 1963 },
  { full_name: 'Christopher A. Coons', gender: 'M', birth: 1963 },
  { full_name: 'Gus M. Bilirakis', gender: 'M', birth: 1963 },
  { full_name: 'Sam Graves', gender: 'M', birth: 1963 },
  { full_name: 'Ron Kind', gender: 'M', birth: 1963 },
  { full_name: 'Rand Paul', gender: 'M', birth: 1963 },
  { full_name: 'Tony Cárdenas', gender: 'M', birth: 1963 },
  { full_name: 'Jackie Walorski', gender: 'F', birth: 1963 },
  { full_name: 'Filemon Vela', gender: 'M', birth: 1963 },
  { full_name: 'Katherine M. Clark', gender: 'F', birth: 1963 },
  { full_name: 'Barry Loudermilk', gender: 'M', birth: 1963 },
  { full_name: 'Don Bacon', gender: 'M', birth: 1963 },
  { full_name: 'TJ Cox', gender: 'M', birth: 1963 },
  { full_name: 'Gregory F. Murphy', gender: 'M', birth: 1963 },
  { full_name: 'Mark S. Critz', gender: 'M', birth: 1962 },
  { full_name: 'Todd Russell Platts', gender: 'M', birth: 1962 },
  { full_name: 'Laura Richardson', gender: 'F', birth: 1962 },
  { full_name: 'Mark Begich', gender: 'M', birth: 1962 },
  { full_name: 'Lee Terry', gender: 'M', birth: 1962 },
  { full_name: 'Patrick J. Tiberi', gender: 'M', birth: 1962 },
  { full_name: 'Joseph Crowley', gender: 'M', birth: 1962 },
  { full_name: 'Jeff Flake', gender: 'M', birth: 1962 },
  { full_name: 'Keith J. Rothfus', gender: 'M', birth: 1962 },
  { full_name: 'Mimi Walters', gender: 'F', birth: 1962 },
  { full_name: 'Karen C. Handel', gender: 'F', birth: 1962 },
  { full_name: 'Tammy Baldwin', gender: 'F', birth: 1962 },
  { full_name: 'Larry Bucshon', gender: 'M', birth: 1962 },
  { full_name: 'Charles J. "Chuck" Fleischmann', gender: 'M', birth: 1962 },
  { full_name: 'Michael T. McCaul', gender: 'M', birth: 1962 },
  { full_name: 'Pete Olson', gender: 'M', birth: 1962 },
  { full_name: 'John P. Sarbanes', gender: 'M', birth: 1962 },
  { full_name: 'David Schweikert', gender: 'M', birth: 1962 },
  { full_name: 'Suzan K. DelBene', gender: 'F', birth: 1962 },
  { full_name: 'Ann Wagner', gender: 'F', birth: 1962 },
  { full_name: 'Steve Daines', gender: 'M', birth: 1962 },
  { full_name: 'Scott Perry', gender: 'M', birth: 1962 },
  { full_name: 'John Katko', gender: 'M', birth: 1962 },
  { full_name: 'Lisa Blunt Rochester', gender: 'F', birth: 1962 },
  { full_name: 'Jamie Raskin', gender: 'M', birth: 1962 },
  { full_name: 'Thomas R. Suozzi', gender: 'M', birth: 1962 },
  { full_name: 'Troy Balderson', gender: 'M', birth: 1962 },
  { full_name: 'Jim Hagedorn', gender: 'M', birth: 1962 },
  { full_name: 'Mary Bono Mack', gender: 'F', birth: 1961 },
  { full_name: 'Mike Ross', gender: 'M', birth: 1961 },
  { full_name: 'Joe Walsh', gender: 'M', birth: 1961 },
  { full_name: 'Allen B. West', gender: 'M', birth: 1961 },
  { full_name: 'Pete P. Gallego', gender: 'M', birth: 1961 },
  { full_name: 'David Vitter', gender: 'M', birth: 1961 },
  { full_name: 'Joseph J. Heck', gender: 'M', birth: 1961 },
  { full_name: 'Ryan K. Zinke', gender: 'M', birth: 1961 },
  { full_name: 'Blake Farenthold', gender: 'M', birth: 1961 },
  { full_name: 'Peter J. Roskam', gender: 'M', birth: 1961 },
  { full_name: 'Bill Shuster', gender: 'M', birth: 1961 },
  { full_name: 'Claudia Tenney', gender: 'F', birth: 1961 },
  { full_name: 'David N. Cicilline', gender: 'M', birth: 1961 },
  { full_name: 'Mario Diaz-Balart', gender: 'M', birth: 1961 },
  { full_name: 'John Thune', gender: 'M', birth: 1961 },
  { full_name: 'Patrick J. Toomey', gender: 'M', birth: 1961 },
  { full_name: 'Juan Vargas', gender: 'M', birth: 1961 },
  { full_name: 'Cheri Bustos', gender: 'F', birth: 1961 },
  { full_name: 'Kevin Cramer', gender: 'M', birth: 1961 },
  { full_name: 'Matt Cartwright', gender: 'M', birth: 1961 },
  { full_name: 'John R. Moolenaar', gender: 'M', birth: 1961 },
  { full_name: 'Tom Emmer', gender: 'M', birth: 1961 },
  { full_name: 'Bradley Scott Schneider', gender: 'M', birth: 1961 },
  { full_name: 'Clay Higgins', gender: 'M', birth: 1961 },
  { full_name: 'Anthony G. Brown', gender: 'M', birth: 1961 },
  { full_name: 'Paul Mitchell', gender: 'M', birth: 1961 },
  { full_name: 'A. Donald McEachin', gender: 'M', birth: 1961 },
  { full_name: 'Greg Gianforte', gender: 'M', birth: 1961 },
  { full_name: 'Kevin Hern', gender: 'M', birth: 1961 },
  { full_name: 'Harley Rouda', gender: 'M', birth: 1961 },
  { full_name: 'Jim Matheson', gender: 'M', birth: 1960 },
  { full_name: 'John E. Walsh', gender: 'M', birth: 1960 },
  { full_name: 'E. Scott Rigell', gender: 'M', birth: 1960 },
  { full_name: 'Loretta Sanchez', gender: 'F', birth: 1960 },
  { full_name: 'Charles W. Dent', gender: 'M', birth: 1960 },
  { full_name: 'Evan H. Jenkins', gender: 'M', birth: 1960 },
  { full_name: 'Dean Heller', gender: 'M', birth: 1960 },
  { full_name: 'Mark Sanford', gender: 'M', birth: 1960 },
  { full_name: 'David A. Trott', gender: 'M', birth: 1960 },
  { full_name: 'Thomas MacArthur', gender: 'M', birth: 1960 },
  { full_name: 'Robert P. Casey, Jr.', gender: 'M', birth: 1960 },
  { full_name: 'Amy Klobuchar', gender: 'F', birth: 1960 },
  { full_name: 'Jeff Fortenberry', gender: 'M', birth: 1960 },
  { full_name: 'Vicky Hartzler', gender: 'F', birth: 1960 },
  { full_name: 'Frank D. Lucas', gender: 'M', birth: 1960 },
  { full_name: 'Adam B. Schiff', gender: 'M', birth: 1960 },
  { full_name: 'Michael R. Turner', gender: 'M', birth: 1960 },
  { full_name: 'Doug LaMalfa', gender: 'M', birth: 1960 },
  { full_name: 'Mark Takano', gender: 'M', birth: 1960 },
  { full_name: 'Susan W. Brooks', gender: 'F', birth: 1960 },
  { full_name: 'Chris Stewart', gender: 'M', birth: 1960 },
  { full_name: 'Jody B. Hice', gender: 'M', birth: 1960 },
  { full_name: 'Mike Bost', gender: 'M', birth: 1960 },
  { full_name: 'Thom Tillis', gender: 'M', birth: 1960 },
  { full_name: 'Roger W. Marshall', gender: 'M', birth: 1960 },
  { full_name: 'John R. Curtis', gender: 'M', birth: 1960 },
  { full_name: 'Lucy McBath', gender: 'F', birth: 1960 },
  { full_name: 'Andy Levin', gender: 'M', birth: 1960 },
  { full_name: 'Debra A. Haaland', gender: 'F', birth: 1960 },
  { full_name: 'Scott P. Brown', gender: 'M', birth: 1959 },
  { full_name: 'Rick Berg', gender: 'M', birth: 1959 },
  { full_name: 'Ben Chandler', gender: 'M', birth: 1959 },
  { full_name: 'Chip Cravaack', gender: 'M', birth: 1959 },
  { full_name: 'Nan A. S. Hayworth', gender: 'F', birth: 1959 },
  { full_name: 'Mike Pence', gender: 'M', birth: 1959 },
  { full_name: 'Jo Bonner', gender: 'M', birth: 1959 },
  { full_name: 'Mark Kirk', gender: 'M', birth: 1959 },
  { full_name: 'Scott Garrett', gender: 'M', birth: 1959 },
  { full_name: 'Jeff Miller', gender: 'M', birth: 1959 },
  { full_name: 'Pedro R. Pierluisi', gender: 'M', birth: 1959 },
  { full_name: 'Curt Clawson', gender: 'M', birth: 1959 },
  { full_name: 'Michelle Lujan Grisham', gender: 'F', birth: 1959 },
  { full_name: 'Dennis A. Ross', gender: 'M', birth: 1959 },
  { full_name: 'Elizabeth H. Esty', gender: 'F', birth: 1959 },
  { full_name: 'Barbara Comstock', gender: 'F', birth: 1959 },
  { full_name: 'Brenda Jones', gender: 'F', birth: 1959 },
  { full_name: 'Mark Meadows', gender: 'M', birth: 1959 },
  { full_name: 'Brian Higgins', gender: 'M', birth: 1959 },
  { full_name: 'James P. McGovern', gender: 'M', birth: 1959 },
  { full_name: 'Glenn Thompson', gender: 'M', birth: 1959 },
  { full_name: 'Chris Van Hollen', gender: 'M', birth: 1959 },
  { full_name: 'Robert J. Wittman', gender: 'M', birth: 1959 },
  { full_name: 'Ken Buck', gender: 'M', birth: 1959 },
  { full_name: 'Cindy Hyde-Smith', gender: 'F', birth: 1959 },
  { full_name: 'Mary Gay Scanlon', gender: 'F', birth: 1959 },
  { full_name: 'Madeleine Dean', gender: 'F', birth: 1959 },
  { full_name: 'Enid Greene Waldholtz', gender: 'F', birth: 1958 },
  { full_name: 'Steve Austria', gender: 'M', birth: 1958 },
  { full_name: 'Russ Carnahan', gender: 'M', birth: 1958 },
  { full_name: 'Kathleen C. Hochul', gender: 'F', birth: 1958 },
  { full_name: 'Alan Nunnelee', gender: 'M', birth: 1958 },
  { full_name: 'Donna F. Edwards', gender: 'F', birth: 1958 },
  { full_name: 'Steve Israel', gender: 'M', birth: 1958 },
  { full_name: 'Matt Salmon', gender: 'M', birth: 1958 },
  { full_name: 'Alan Grayson', gender: 'M', birth: 1958 },
  { full_name: 'Xavier Becerra', gender: 'M', birth: 1958 },
  { full_name: 'James B. Renacci', gender: 'M', birth: 1958 },
  { full_name: 'Maria Cantwell', gender: 'F', birth: 1958 },
  { full_name: 'Paul A. Gosar', gender: 'M', birth: 1958 },
  { full_name: 'H. Morgan Griffith', gender: 'M', birth: 1958 },
  { full_name: 'Gary C. Peters', gender: 'M', birth: 1958 },
  { full_name: 'Mike Quigley', gender: 'M', birth: 1958 },
  { full_name: 'Mike Rogers', gender: 'M', birth: 1958 },
  { full_name: 'John Shimkus', gender: 'M', birth: 1958 },
  { full_name: 'Mac Thornberry', gender: 'M', birth: 1958 },
  { full_name: 'Mark E. Amodei', gender: 'M', birth: 1958 },
  { full_name: 'Donald M. Payne, Jr.', gender: 'M', birth: 1958 },
  { full_name: 'Scott H. Peters', gender: 'M', birth: 1958 },
  { full_name: 'Daniel T. Kildee', gender: 'M', birth: 1958 },
  { full_name: 'Brad R. Wenstrup', gender: 'M', birth: 1958 },
  { full_name: 'Tim Kaine', gender: 'M', birth: 1958 },
  { full_name: 'Donald Norcross', gender: 'M', birth: 1958 },
  { full_name: 'Margaret Wood Hassan', gender: 'F', birth: 1958 },
  { full_name: 'Andy Biggs', gender: 'M', birth: 1958 },
  { full_name: 'J. Luis Correa', gender: 'M', birth: 1958 },
  { full_name: 'Tina Smith', gender: 'F', birth: 1958 },
  { full_name: 'Debbie Lesko', gender: 'F', birth: 1958 },
  { full_name: 'Hansen Clarke', gender: 'M', birth: 1957 },
  { full_name: 'Tim Holden', gender: 'M', birth: 1957 },
  { full_name: 'Robert E. Andrews', gender: 'M', birth: 1957 },
  { full_name: 'Bruce L. Braley', gender: 'M', birth: 1957 },
  { full_name: 'Cresent Hardy', gender: 'M', birth: 1957 },
  { full_name: 'Trent Franks', gender: 'M', birth: 1957 },
  { full_name: 'Jeb Hensarling', gender: 'M', birth: 1957 },
  { full_name: 'Bill Cassidy', gender: 'M', birth: 1957 },
  { full_name: 'Diana DeGette', gender: 'F', birth: 1957 },
  { full_name: 'Andy Harris', gender: 'M', birth: 1957 },
  { full_name: 'John Hoeven', gender: 'M', birth: 1957 },
  { full_name: 'Lisa Murkowski', gender: 'F', birth: 1957 },
  { full_name: 'Greg Walden', gender: 'M', birth: 1957 },
  { full_name: 'Steve Womack', gender: 'M', birth: 1957 },
  { full_name: 'David P. Joyce', gender: 'M', birth: 1957 },
  { full_name: 'Tom Rice', gender: 'M', birth: 1957 },
  { full_name: 'Earl L. "Buddy" Carter', gender: 'M', birth: 1957 },
  { full_name: 'Val Butler Demings', gender: 'F', birth: 1957 },
  { full_name: 'Jacky Rosen', gender: 'F', birth: 1957 },
  { full_name: 'Joseph D. Morelle', gender: 'M', birth: 1957 },
  { full_name: 'Susan Wild', gender: 'F', birth: 1957 },
  { full_name: 'John Joyce', gender: 'M', birth: 1957 },
  { full_name: 'Thomas P. Tiffany', gender: 'M', birth: 1957 },
  { full_name: 'Sandy Adams', gender: 'F', birth: 1956 },
  { full_name: 'Michele Bachmann', gender: 'F', birth: 1956 },
  { full_name: 'Mike McIntyre', gender: 'M', birth: 1956 },
  { full_name: 'Steve Stockman', gender: 'M', birth: 1956 },
  { full_name: 'Chaka Fattah', gender: 'M', birth: 1956 },
  { full_name: 'Charles W. Boustany Jr.', gender: 'M', birth: 1956 },
  { full_name: 'John C. Carney Jr.', gender: 'M', birth: 1956 },
  { full_name: 'Reid J. Ribble', gender: 'M', birth: 1956 },
  { full_name: 'Lou Barletta', gender: 'M', birth: 1956 },
  { full_name: 'John Abney Culberson', gender: 'M', birth: 1956 },
  { full_name: 'Gregg Harper', gender: 'M', birth: 1956 },
  { full_name: 'Daniel M. Donovan, Jr.', gender: 'M', birth: 1956 },
  { full_name: 'Jon Tester', gender: 'M', birth: 1956 },
  { full_name: 'Jeff Merkley', gender: 'M', birth: 1956 },
  { full_name: 'Wm. Lacy Clay', gender: 'M', birth: 1956 },
  { full_name: 'Robert E. Latta', gender: 'M', birth: 1956 },
  { full_name: 'Tom McClintock', gender: 'M', birth: 1956 },
  { full_name: 'Scott R. Tipton', gender: 'M', birth: 1956 },
  { full_name: 'Ann M. Kuster', gender: 'F', birth: 1956 },
  { full_name: 'Robin L. Kelly', gender: 'F', birth: 1956 },
  { full_name: 'J. French Hill', gender: 'M', birth: 1956 },
  { full_name: 'Charlie Crist', gender: 'M', birth: 1956 },
  { full_name: 'Ron Estes', gender: 'M', birth: 1956 },
  { full_name: 'Jesús G. "Chuy" García', gender: 'M', birth: 1956 },
  { full_name: 'Greg Pence', gender: 'M', birth: 1956 },
  { full_name: 'Denny Rehberg', gender: 'M', birth: 1955 },
  { full_name: 'Mary L. Landrieu', gender: 'F', birth: 1955 },
  { full_name: 'John Barrow', gender: 'M', birth: 1955 },
  { full_name: 'John Campbell', gender: 'M', birth: 1955 },
  { full_name: 'Jim Gerlach', gender: 'M', birth: 1955 },
  { full_name: 'Jack Kingston', gender: 'M', birth: 1955 },
  { full_name: 'Michael H. Michaud', gender: 'M', birth: 1955 },
  { full_name: 'Patrick Meehan', gender: 'M', birth: 1955 },
  { full_name: 'Mike Coffman', gender: 'M', birth: 1955 },
  { full_name: 'Joe Donnelly', gender: 'M', birth: 1955 },
  { full_name: 'Pete Sessions', gender: 'M', birth: 1955 },
  { full_name: 'Heidi Heitkamp', gender: 'F', birth: 1955 },
  { full_name: 'Rod Blum', gender: 'M', birth: 1955 },
  { full_name: 'Jason Lewis', gender: 'M', birth: 1955 },
  { full_name: 'Sheldon Whitehouse', gender: 'M', birth: 1955 },
  { full_name: 'Lindsey Graham', gender: 'M', birth: 1955 },
  { full_name: 'Kevin Brady', gender: 'M', birth: 1955 },
  { full_name: 'Richard Burr', gender: 'M', birth: 1955 },
  { full_name: 'Henry Cuellar', gender: 'M', birth: 1955 },
  { full_name: 'Ron Johnson', gender: 'M', birth: 1955 },
  { full_name: 'Billy Long', gender: 'M', birth: 1955 },
  { full_name: 'Stephen F. Lynch', gender: 'M', birth: 1955 },
  { full_name: 'Chellie Pingree', gender: 'F', birth: 1955 },
  { full_name: 'Rob Portman', gender: 'M', birth: 1955 },
  { full_name: 'Gregorio Kilili Camacho Sablan', gender: 'M', birth: 1955 },
  { full_name: 'Bill Foster', gender: 'M', birth: 1955 },
  { full_name: 'Ted S. Yoho', gender: 'M', birth: 1955 },
  { full_name: 'Bradley Byrne', gender: 'M', birth: 1955 },
  { full_name: 'Dan Newhouse', gender: 'M', birth: 1955 },
  { full_name: 'Glenn Grothman', gender: 'M', birth: 1955 },
  { full_name: 'David J. Trone', gender: 'M', birth: 1955 },
  { full_name: 'Steven C. LaTourette', gender: 'M', birth: 1954 },
  { full_name: 'Candice S. Miller', gender: 'F', birth: 1954 },
  { full_name: 'Cynthia M. Lummis', gender: 'F', birth: 1954 },
  { full_name: 'Tom Price', gender: 'M', birth: 1954 },
  { full_name: 'Robert Menendez', gender: 'M', birth: 1954 },
  { full_name: 'Mark R. Warner', gender: 'M', birth: 1954 },
  { full_name: 'Mo Brooks', gender: 'M', birth: 1954 },
  { full_name: 'Jim Cooper', gender: 'M', birth: 1954 },
  { full_name: 'Bill Flores', gender: 'M', birth: 1954 },
  { full_name: 'Bob Gibbs', gender: 'M', birth: 1954 },
  { full_name: 'Bill Johnson', gender: 'M', birth: 1954 },
  { full_name: 'Henry C. "Hank" Johnson, Jr.', gender: 'M', birth: 1954 },
  { full_name: 'Doug Lamborn', gender: 'M', birth: 1954 },
  { full_name: 'Betty McCollum', gender: 'F', birth: 1954 },
  { full_name: 'Jerry Moran', gender: 'M', birth: 1954 },
  { full_name: 'Brad Sherman', gender: 'M', birth: 1954 },
  { full_name: 'Suzanne Bonamici', gender: 'F', birth: 1954 },
  { full_name: 'Gary J. Palmer', gender: 'M', birth: 1954 },
  { full_name: 'Ralph Lee Abraham', gender: 'M', birth: 1954 },
  { full_name: 'Brenda L. Lawrence', gender: 'F', birth: 1954 },
  { full_name: 'Mike Rounds', gender: 'M', birth: 1954 },
  { full_name: 'Dwight Evans', gender: 'M', birth: 1954 },
  { full_name: 'Adriano Espaillat', gender: 'M', birth: 1954 },
  { full_name: 'Doug Jones', gender: 'M', birth: 1954 },
  { full_name: 'Mike Braun', gender: 'M', birth: 1954 },
  { full_name: 'Brad Miller', gender: 'M', birth: 1953 },
  { full_name: 'Kay R. Hagan', gender: 'F', birth: 1953 },
  { full_name: 'Dave Camp', gender: 'M', birth: 1953 },
  { full_name: 'Luther Strange', gender: 'M', birth: 1953 },
  { full_name: 'Claire McCaskill', gender: 'F', birth: 1953 },
  { full_name: 'Luis V. Gutiérrez', gender: 'M', birth: 1953 },
  { full_name: 'Darrell E. Issa', gender: 'M', birth: 1953 },
  { full_name: 'Bruce Poliquin', gender: 'M', birth: 1953 },
  { full_name: 'Karen Bass', gender: 'F', birth: 1953 },
  { full_name: 'Ken Calvert', gender: 'M', birth: 1953 },
  { full_name: 'Shelley Moore Capito', gender: 'F', birth: 1953 },
  { full_name: 'Steve Chabot', gender: 'M', birth: 1953 },
  { full_name: 'Judy Chu', gender: 'F', birth: 1953 },
  { full_name: 'Joe Courtney', gender: 'M', birth: 1953 },
  { full_name: 'Michael F. Doyle', gender: 'M', birth: 1953 },
  { full_name: 'Louie Gohmert', gender: 'M', birth: 1953 },
  { full_name: 'Gregory W. Meeks', gender: 'M', birth: 1953 },
  { full_name: 'Ed Perlmutter', gender: 'M', birth: 1953 },
  { full_name: 'Christopher H. Smith', gender: 'M', birth: 1953 },
  { full_name: 'Fred Upton', gender: 'M', birth: 1953 },
  { full_name: 'Nydia M. Velázquez', gender: 'F', birth: 1953 },
  { full_name: 'Randy K. Weber, Sr.', gender: 'M', birth: 1953 },
  { full_name: 'Debbie Dingell', gender: 'F', birth: 1953 },
  { full_name: 'Neal P. Dunn', gender: 'M', birth: 1953 },
  { full_name: 'Francis Rooney', gender: 'M', birth: 1953 },
  { full_name: 'Ralph Norman', gender: 'M', birth: 1953 },
  { full_name: 'Jefferson Van Drew', gender: 'M', birth: 1953 },
  { full_name: 'Ron Wright', gender: 'M', birth: 1953 },
  { full_name: 'Charles F. Bass', gender: 'M', birth: 1952 },
  { full_name: 'David Dreier', gender: 'M', birth: 1952 },
  { full_name: 'Steven R. Rothman', gender: 'M', birth: 1952 },
  { full_name: 'Janice Hahn', gender: 'F', birth: 1952 },
  { full_name: 'Dan Benishek', gender: 'M', birth: 1952 },
  { full_name: 'J. Randy Forbes', gender: 'M', birth: 1952 },
  { full_name: 'Tim Murphy', gender: 'M', birth: 1952 },
  { full_name: 'Bob Corker', gender: 'M', birth: 1952 },
  { full_name: 'Michael E. Capuano', gender: 'M', birth: 1952 },
  { full_name: 'Bob Goodlatte', gender: 'M', birth: 1952 },
  { full_name: 'Leonard Lance', gender: 'M', birth: 1952 },
  { full_name: 'Ileana Ros-Lehtinen', gender: 'F', birth: 1952 },
  { full_name: 'Carol Shea-Porter', gender: 'F', birth: 1952 },
  { full_name: 'John J. Faso', gender: 'M', birth: 1952 },
  { full_name: 'Tom Marino', gender: 'M', birth: 1952 },
  { full_name: 'Sherrod Brown', gender: 'M', birth: 1952 },
  { full_name: 'John Barrasso', gender: 'M', birth: 1952 },
  { full_name: 'Susan M. Collins', gender: 'F', birth: 1952 },
  { full_name: 'John Cornyn', gender: 'M', birth: 1952 },
  { full_name: 'Marsha Blackburn', gender: 'F', birth: 1952 },
  { full_name: 'Jim Costa', gender: 'M', birth: 1952 },
  { full_name: 'Marcia L. Fudge', gender: 'F', birth: 1952 },
  { full_name: 'William R. Keating', gender: 'M', birth: 1952 },
  { full_name: 'David Loebsack', gender: 'M', birth: 1952 },
  { full_name: 'Blaine Luetkemeyer', gender: 'M', birth: 1952 },
  { full_name: 'Julia Brownley', gender: 'F', birth: 1952 },
  { full_name: 'Denny Heck', gender: 'M', birth: 1952 },
  { full_name: 'Mark DeSaulnier', gender: 'M', birth: 1952 },
  { full_name: 'John H. Rutherford', gender: 'M', birth: 1952 },
  { full_name: 'Ed Case', gender: 'M', birth: 1952 },
  { full_name: 'Rick Scott', gender: 'M', birth: 1952 },
  { full_name: 'Shelley Berkley', gender: 'F', birth: 1951 },
  { full_name: 'Brian P. Bilbray', gender: 'M', birth: 1951 },
  { full_name: 'Ann Marie Buerkle', gender: 'F', birth: 1951 },
  { full_name: 'Larry Kissell', gender: 'M', birth: 1951 },
  { full_name: 'Jean Schmidt', gender: 'F', birth: 1951 },
  { full_name: 'Jim DeMint', gender: 'M', birth: 1951 },
  { full_name: 'John F. Tierney', gender: 'M', birth: 1951 },
  { full_name: 'Kerry L. Bentivolio', gender: 'M', birth: 1951 },
  { full_name: 'John Fleming', gender: 'M', birth: 1951 },
  { full_name: 'Richard L. Hanna', gender: 'M', birth: 1951 },
  { full_name: 'Richard B. Nugent', gender: 'M', birth: 1951 },
  { full_name: 'Al Franken', gender: 'M', birth: 1951 },
  { full_name: 'Diane Black', gender: 'F', birth: 1951 },
  { full_name: 'Edward R. Royce', gender: 'M', birth: 1951 },
  { full_name: 'Colleen Hanabusa', gender: 'F', birth: 1951 },
  { full_name: 'Elijah E. Cummings', gender: 'M', birth: 1951 },
  { full_name: 'Roger F. Wicker', gender: 'M', birth: 1951 },
  { full_name: 'Rob Bishop', gender: 'M', birth: 1951 },
  { full_name: 'Vern Buchanan', gender: 'M', birth: 1951 },
  { full_name: 'Mike Crapo', gender: 'M', birth: 1951 },
  { full_name: 'Kenny Marchant', gender: 'M', birth: 1951 },
  { full_name: 'Jerry McNerney', gender: 'M', birth: 1951 },
  { full_name: 'Gwen Moore', gender: 'F', birth: 1951 },
  { full_name: 'Frank Pallone, Jr.', gender: 'M', birth: 1951 },
  { full_name: 'Kurt Schrader', gender: 'M', birth: 1951 },
  { full_name: 'Albio Sires', gender: 'M', birth: 1951 },
  { full_name: 'Mike Thompson', gender: 'M', birth: 1951 },
  { full_name: 'Tim Walberg', gender: 'M', birth: 1951 },
  { full_name: 'Deb Fischer', gender: 'F', birth: 1951 },
  { full_name: 'Rick W. Allen', gender: 'M', birth: 1951 },
  { full_name: 'John Kennedy', gender: 'M', birth: 1951 },
  { full_name: 'Jo Ann Emerson', gender: 'F', birth: 1950 },
  { full_name: 'Mark Udall', gender: 'M', birth: 1950 },
  { full_name: 'Timothy H. Bishop', gender: 'M', birth: 1950 },
  { full_name: 'Mike Johanns', gender: 'M', birth: 1950 },
  { full_name: 'Lynn A. Westmoreland', gender: 'M', birth: 1950 },
  { full_name: 'David G. Reichert', gender: 'M', birth: 1950 },
  { full_name: 'Chris Collins', gender: 'M', birth: 1950 },
  { full_name: 'Debbie Stabenow', gender: 'F', birth: 1950 },
  { full_name: 'Roy Blunt', gender: 'M', birth: 1950 },
  { full_name: 'John Boozman', gender: 'M', birth: 1950 },
  { full_name: 'Michael C. Burgess', gender: 'M', birth: 1950 },
  { full_name: 'Gerald E. Connolly', gender: 'M', birth: 1950 },
  { full_name: 'Sheila Jackson Lee', gender: 'F', birth: 1950 },
  { full_name: 'Patty Murray', gender: 'F', birth: 1950 },
  { full_name: 'Charles E. Schumer', gender: 'M', birth: 1950 },
  { full_name: 'Michael K. Simpson', gender: 'M', birth: 1950 },
  { full_name: 'Jackie Speier', gender: 'F', birth: 1950 },
  { full_name: 'Dina Titus', gender: 'F', birth: 1950 },
  { full_name: 'Joyce Beatty', gender: 'F', birth: 1950 },
  { full_name: 'Donald S. Beyer, Jr.', gender: 'M', birth: 1950 },
  { full_name: 'Ann Kirkpatrick', gender: 'F', birth: 1950 },
  { full_name: 'Sylvia R. Garcia', gender: 'F', birth: 1950 },
  { full_name: 'Carol D. Miller', gender: 'F', birth: 1950 },
  { full_name: 'Francisco "Quico" Canseco', gender: 'M', birth: 1949 },
  { full_name: 'Jerry F. Costello', gender: 'M', birth: 1949 },
  { full_name: 'William L. Owens', gender: 'M', birth: 1949 },
  { full_name: 'Nick J. Rahall II', gender: 'M', birth: 1949 },
  { full_name: 'William L. Enyart', gender: 'M', birth: 1949 },
  { full_name: 'John A. Boehner', gender: 'M', birth: 1949 },
  { full_name: 'Randy Neugebauer', gender: 'M', birth: 1949 },
  { full_name: 'Brad Ashford', gender: 'M', birth: 1949 },
  { full_name: 'Joe Barton', gender: 'M', birth: 1949 },
  { full_name: 'Jack Reed', gender: 'M', birth: 1949 },
  { full_name: 'Steve Cohen', gender: 'M', birth: 1949 },
  { full_name: 'Tom Cole', gender: 'M', birth: 1949 },
  { full_name: 'Steve King', gender: 'M', birth: 1949 },
  { full_name: 'Richard E. Neal', gender: 'M', birth: 1949 },
  { full_name: 'Paul Tonko', gender: 'M', birth: 1949 },
  { full_name: 'Peter J. Visclosky', gender: 'M', birth: 1949 },
  { full_name: 'Daniel Webster', gender: 'M', birth: 1949 },
  { full_name: 'Ron Wyden', gender: 'M', birth: 1949 },
  { full_name: 'Elizabeth Warren', gender: 'F', birth: 1949 },
  { full_name: 'Roger Williams', gender: 'M', birth: 1949 },
  { full_name: 'David Perdue', gender: 'M', birth: 1949 },
  { full_name: 'Kent Conrad', gender: 'M', birth: 1948 },
  { full_name: 'David Alan Curson', gender: 'M', birth: 1948 },
  { full_name: 'Tom Coburn', gender: 'M', birth: 1948 },
  { full_name: 'Rush Holt', gender: 'M', birth: 1948 },
  { full_name: 'Tom Latham', gender: 'M', birth: 1948 },
  { full_name: 'Gary G. Miller', gender: 'M', birth: 1948 },
  { full_name: 'Allyson Y. Schwartz', gender: 'F', birth: 1948 },
  { full_name: 'Ted Poe', gender: 'M', birth: 1948 },
  { full_name: 'Robert Pittenger', gender: 'M', birth: 1948 },
  { full_name: 'Tom Udall', gender: 'M', birth: 1948 },
  { full_name: 'Earl Blumenauer', gender: 'M', birth: 1948 },
  { full_name: 'K. Michael Conaway', gender: 'M', birth: 1948 },
  { full_name: 'Raúl M. Grijalva', gender: 'M', birth: 1948 },
  { full_name: 'Mike Kelly', gender: 'M', birth: 1948 },
  { full_name: 'John B. Larson', gender: 'M', birth: 1948 },
  { full_name: 'Bennie G. Thompson', gender: 'M', birth: 1948 },
  { full_name: 'Lois Frankel', gender: 'F', birth: 1948 },
  { full_name: 'Brian Babin', gender: 'M', birth: 1948 },
  { full_name: 'Al Lawson, Jr.', gender: 'M', birth: 1948 },
  { full_name: 'Kweisi Mfume', gender: 'M', birth: 1948 },
  { full_name: 'Olympia J. Snowe', gender: 'F', birth: 1947 },
  { full_name: 'W. Todd Akin', gender: 'M', birth: 1947 },
  { full_name: 'Joe Baca', gender: 'M', birth: 1947 },
  { full_name: 'Spencer Bachus', gender: 'M', birth: 1947 },
  { full_name: 'John Kline', gender: 'M', birth: 1947 },
  { full_name: 'John J. Duncan, Jr.', gender: 'M', birth: 1947 },
  { full_name: 'Gene Green', gender: 'M', birth: 1947 },
  { full_name: 'Stevan Pearce', gender: 'M', birth: 1947 },
  { full_name: 'Dana Rohrabacher', gender: 'M', birth: 1947 },
  { full_name: 'Lamar Smith', gender: 'M', birth: 1947 },
  { full_name: 'Thomas R. Carper', gender: 'M', birth: 1947 },
  { full_name: 'Jeanne Shaheen', gender: 'F', birth: 1947 },
  { full_name: 'Joe Manchin, III', gender: 'M', birth: 1947 },
  { full_name: 'Sanford D. Bishop, Jr.', gender: 'M', birth: 1947 },
  { full_name: 'G. K. Butterfield', gender: 'M', birth: 1947 },
  { full_name: 'Peter A. DeFazio', gender: 'M', birth: 1947 },
  { full_name: 'Eliot L. Engel', gender: 'M', birth: 1947 },
  { full_name: 'Al Green', gender: 'M', birth: 1947 },
  { full_name: 'Mazie K. Hirono', gender: 'F', birth: 1947 },
  { full_name: 'Zoe Lofgren', gender: 'F', birth: 1947 },
  { full_name: 'David B. McKinley', gender: 'M', birth: 1947 },
  { full_name: 'Jerrold Nadler', gender: 'M', birth: 1947 },
  { full_name: 'Bill Posey', gender: 'M', birth: 1947 },
  { full_name: 'Robert C. "Bobby" Scott', gender: 'M', birth: 1947 },
  { full_name: 'Peter Welch', gender: 'M', birth: 1947 },
  { full_name: 'Joe Wilson', gender: 'M', birth: 1947 },
  { full_name: 'John A. Yarmuth', gender: 'M', birth: 1947 },
  { full_name: 'Aumua Amata Coleman Radewagen', gender: 'F', birth: 1947 },
  { full_name: 'Jack Bergman', gender: 'M', birth: 1947 },
  { full_name: 'Mitt Romney', gender: 'M', birth: 1947 },
  { full_name: 'Jim Webb', gender: 'M', birth: 1946 },
  { full_name: 'Timothy V. Johnson', gender: 'M', birth: 1946 },
  { full_name: 'Dennis J. Kucinich', gender: 'M', birth: 1946 },
  { full_name: 'Daniel E. Lungren', gender: 'M', birth: 1946 },
  { full_name: 'Rodney Alexander', gender: 'M', birth: 1946 },
  { full_name: 'Tim Johnson', gender: 'M', birth: 1946 },
  { full_name: 'Paul C. Broun', gender: 'M', birth: 1946 },
  { full_name: 'Corrine Brown', gender: 'F', birth: 1946 },
  { full_name: 'Jeff Sessions', gender: 'M', birth: 1946 },
  { full_name: 'Rodney P. Frelinghuysen', gender: 'M', birth: 1946 },
  { full_name: 'Frank A. LoBiondo', gender: 'M', birth: 1946 },
  { full_name: 'Niki Tsongas', gender: 'F', birth: 1946 },
  { full_name: 'Richard Blumenthal', gender: 'M', birth: 1946 },
  { full_name: 'Lloyd Doggett', gender: 'M', birth: 1946 },
  { full_name: 'Marcy Kaptur', gender: 'F', birth: 1946 },
  { full_name: 'Barbara Lee', gender: 'F', birth: 1946 },
  { full_name: 'Carolyn B. Maloney', gender: 'F', birth: 1946 },
  { full_name: 'Edward J. Markey', gender: 'M', birth: 1946 },
  { full_name: 'C. A. Dutch Ruppersberger', gender: 'M', birth: 1946 },
  { full_name: 'Bobby L. Rush', gender: 'M', birth: 1946 },
  { full_name: 'Alma S. Adams', gender: 'F', birth: 1946 },
  { full_name: 'Tom O’Halleran', gender: 'M', birth: 1946 },
  { full_name: 'Charles A. Gonzalez', gender: 'M', birth: 1945 },
  { full_name: 'Wally Herger', gender: 'M', birth: 1945 },
  { full_name: 'Melvin L. Watt', gender: 'M', birth: 1945 },
  { full_name: 'Donna M. Christensen', gender: 'F', birth: 1945 },
  { full_name: 'George Miller', gender: 'M', birth: 1945 },
  { full_name: 'James P. Moran', gender: 'M', birth: 1945 },
  { full_name: 'Ron Barber', gender: 'M', birth: 1945 },
  { full_name: 'Robert A. Brady', gender: 'M', birth: 1945 },
  { full_name: 'John Garamendi', gender: 'M', birth: 1945 },
  { full_name: 'David P. Roe', gender: 'M', birth: 1945 },
  { full_name: 'David Scott', gender: 'M', birth: 1945 },
  { full_name: 'Bonnie Watson Coleman', gender: 'F', birth: 1945 },
  { full_name: 'James R. Baird', gender: 'M', birth: 1945 },
  { full_name: 'Elton Gallegly', gender: 'M', birth: 1944 },
  { full_name: 'Donald A. Manzullo', gender: 'M', birth: 1944 },
  { full_name: 'Silvestre Reyes', gender: 'M', birth: 1944 },
  { full_name: 'Carolyn McCarthy', gender: 'F', birth: 1944 },
  { full_name: 'Ander Crenshaw', gender: 'M', birth: 1944 },
  { full_name: 'Johnny Isakson', gender: 'M', birth: 1944 },
  { full_name: 'Richard J. Durbin', gender: 'M', birth: 1944 },
  { full_name: 'Michael B. Enzi', gender: 'M', birth: 1944 },
  { full_name: 'Emanuel Cleaver', gender: 'M', birth: 1944 },
  { full_name: 'Susan A. Davis', gender: 'F', birth: 1944 },
  { full_name: 'Peter T. King', gender: 'M', birth: 1944 },
  { full_name: 'Doris O. Matsui', gender: 'F', birth: 1944 },
  { full_name: 'Collin C. Peterson', gender: 'M', birth: 1944 },
  { full_name: 'Janice D. Schakowsky', gender: 'F', birth: 1944 },
  { full_name: 'Angus S. King, Jr.', gender: 'M', birth: 1944 },
  { full_name: 'Jeff Bingaman', gender: 'M', birth: 1943 },
  { full_name: 'Kay Bailey Hutchison', gender: 'F', birth: 1943 },
  { full_name: 'John F. Kerry', gender: 'M', birth: 1943 },
  { full_name: 'Saxby Chambliss', gender: 'M', birth: 1943 },
  { full_name: 'Eni F. H. Faleomavaega', gender: 'M', birth: 1943 },
  { full_name: 'Ed Pastor', gender: 'M', birth: 1943 },
  { full_name: 'Ed Whitfield', gender: 'M', birth: 1943 },
  { full_name: 'Daniel Coats', gender: 'M', birth: 1943 },
  { full_name: 'John L. Mica', gender: 'M', birth: 1943 },
  { full_name: 'Richard M. Nolan', gender: 'M', birth: 1943 },
  { full_name: 'Walter B. Jones', gender: 'M', birth: 1943 },
  { full_name: 'Benjamin L. Cardin', gender: 'M', birth: 1943 },
  { full_name: 'James E. Risch', gender: 'M', birth: 1943 },
  { full_name: 'Rosa L. DeLauro', gender: 'F', birth: 1943 },
  { full_name: 'Virginia Foxx', gender: 'F', birth: 1943 },
  { full_name: 'Kay Granger', gender: 'F', birth: 1943 },
  { full_name: 'F. James Sensenbrenner, Jr.', gender: 'M', birth: 1943 },
  { full_name: 'José E. Serrano', gender: 'M', birth: 1943 },
  { full_name: 'Paul Cook', gender: 'M', birth: 1943 },
  { full_name: 'Bob Filner', gender: 'M', birth: 1942 },
  { full_name: 'Joseph I. Lieberman', gender: 'M', birth: 1942 },
  { full_name: 'Gary L. Ackerman', gender: 'M', birth: 1942 },
  { full_name: 'Phil Gingrey', gender: 'M', birth: 1942 },
  { full_name: 'Jon Kyl', gender: 'M', birth: 1942 },
  { full_name: 'Bill Nelson', gender: 'M', birth: 1942 },
  { full_name: 'Mitch McConnell', gender: 'M', birth: 1942 },
  { full_name: 'Anna G. Eshoo', gender: 'F', birth: 1942 },
  { full_name: 'Frederica S. Wilson', gender: 'F', birth: 1942 },
  { full_name: 'Ben Nelson', gender: 'M', birth: 1941 },
  { full_name: 'Howard L. Berman', gender: 'M', birth: 1941 },
  { full_name: 'Sue Wilkins Myrick', gender: 'F', birth: 1941 },
  { full_name: 'Cliff Stearns', gender: 'M', birth: 1941 },
  { full_name: 'Robert L. Turner', gender: 'M', birth: 1941 },
  { full_name: 'Max Baucus', gender: 'M', birth: 1941 },
  { full_name: 'Doc Hastings', gender: 'M', birth: 1941 },
  { full_name: 'Gloria Negrete McLeod', gender: 'F', birth: 1941 },
  { full_name: 'Sam Farr', gender: 'M', birth: 1941 },
  { full_name: 'Michael M. Honda', gender: 'M', birth: 1941 },
  { full_name: 'Bernard Sanders', gender: 'M', birth: 1941 },
  { full_name: 'John R. Carter', gender: 'M', birth: 1941 },
  { full_name: 'Danny K. Davis', gender: 'M', birth: 1941 },
  { full_name: 'Lucille Roybal-Allard', gender: 'F', birth: 1941 },
  { full_name: 'Alan S. Lowenthal', gender: 'M', birth: 1941 },
  { full_name: 'Donna E. Shalala', gender: 'F', birth: 1941 },
  { full_name: 'Norman D. Dicks', gender: 'M', birth: 1940 },
  { full_name: 'Barney Frank', gender: 'M', birth: 1940 },
  { full_name: 'Thomas E. Petri', gender: 'M', birth: 1940 },
  { full_name: 'Barbara Boxer', gender: 'F', birth: 1940 },
  { full_name: 'Rubén Hinojosa', gender: 'M', birth: 1940 },
  { full_name: 'John Lewis', gender: 'M', birth: 1940 },
  { full_name: 'Lamar Alexander', gender: 'M', birth: 1940 },
  { full_name: 'James E. Clyburn', gender: 'M', birth: 1940 },
  { full_name: 'Patrick J. Leahy', gender: 'M', birth: 1940 },
  { full_name: 'Nancy Pelosi', gender: 'F', birth: 1940 },
  { full_name: 'David E. Price', gender: 'M', birth: 1940 },
  { full_name: 'Tom Harkin', gender: 'M', birth: 1939 },
  { full_name: 'Henry A. Waxman', gender: 'M', birth: 1939 },
  { full_name: 'Frank R. Wolf', gender: 'M', birth: 1939 },
  { full_name: 'Harry Reid', gender: 'M', birth: 1939 },
  { full_name: 'Joseph R. Pitts', gender: 'M', birth: 1939 },
  { full_name: 'Steny H. Hoyer', gender: 'M', birth: 1939 },
  { full_name: 'Dan Burton', gender: 'M', birth: 1938 },
  { full_name: 'Maurice D. Hinchey', gender: 'M', birth: 1938 },
  { full_name: 'Howard P. "Buck" McKeon', gender: 'M', birth: 1938 },
  { full_name: 'Lois Capps', gender: 'F', birth: 1938 },
  { full_name: 'Maxine Waters', gender: 'F', birth: 1938 },
  { full_name: 'Judy Biggert', gender: 'F', birth: 1937 },
  { full_name: 'Lynn C. Woolsey', gender: 'F', birth: 1937 },
  { full_name: 'John D. Rockefeller, IV', gender: 'M', birth: 1937 },
  { full_name: 'Thad Cochran', gender: 'M', birth: 1937 },
  { full_name: 'Nita M. Lowey', gender: 'F', birth: 1937 },
  { full_name: 'Eleanor Holmes Norton', gender: 'F', birth: 1937 },
  { full_name: 'Bill Pascrell, Jr.', gender: 'M', birth: 1937 },
  { full_name: 'Harold Rogers', gender: 'M', birth: 1937 },
  { full_name: 'John W. Olver', gender: 'M', birth: 1936 },
  { full_name: 'Barbara A. Mikulski', gender: 'F', birth: 1936 },
  { full_name: 'Jim McDermott', gender: 'M', birth: 1936 },
  { full_name: 'John McCain', gender: 'M', birth: 1936 },
  { full_name: 'Pat Roberts', gender: 'M', birth: 1936 },
  { full_name: 'Alcee L. Hastings', gender: 'M', birth: 1936 },
  { full_name: 'Grace F. Napolitano', gender: 'F', birth: 1936 },
  { full_name: 'Herb Kohl', gender: 'M', birth: 1935 },
  { full_name: 'Ron Paul', gender: 'M', birth: 1935 },
  { full_name: 'Eddie Bernice Johnson', gender: 'F', birth: 1935 },
  { full_name: 'Leonard L. Boswell', gender: 'M', birth: 1934 },
  { full_name: 'Jerry Lewis', gender: 'M', birth: 1934 },
  { full_name: 'Edolphus Towns', gender: 'M', birth: 1934 },
  { full_name: 'Carl Levin', gender: 'M', birth: 1934 },
  { full_name: 'Orrin G. Hatch', gender: 'M', birth: 1934 },
  { full_name: 'James M. Inhofe', gender: 'M', birth: 1934 },
  { full_name: 'Richard C. Shelby', gender: 'M', birth: 1934 },
  { full_name: 'Madeleine Z. Bordallo', gender: 'F', birth: 1933 },
  { full_name: 'Dianne Feinstein', gender: 'F', birth: 1933 },
  { full_name: 'Chuck Grassley', gender: 'M', birth: 1933 },
  { full_name: 'Don Young', gender: 'M', birth: 1933 },
  { full_name: 'Richard G. Lugar', gender: 'M', birth: 1932 },
  { full_name: 'Fortney Pete Stark', gender: 'M', birth: 1931 },
  { full_name: 'Howard Coble', gender: 'M', birth: 1931 },
  { full_name: 'Sander M. Levin', gender: 'M', birth: 1931 },
  { full_name: 'C. W. Bill Young', gender: 'M', birth: 1930 },
  { full_name: 'Charles B. Rangel', gender: 'M', birth: 1930 },
  { full_name: 'Sam Johnson', gender: 'M', birth: 1930 },
  { full_name: 'Dale E. Kildee', gender: 'M', birth: 1929 },
  { full_name: 'John Conyers, Jr.', gender: 'M', birth: 1929 },
  { full_name: 'Louise McIntosh Slaughter', gender: 'F', birth: 1929 },
  { full_name: 'Roscoe G. Bartlett', gender: 'M', birth: 1926 },
  { full_name: 'John D. Dingell', gender: 'M', birth: 1926 },
  { full_name: 'Daniel K. Inouye', gender: 'M', birth: 1924 },
  { full_name: 'Daniel K. Akaka', gender: 'M', birth: 1924 },
  { full_name: 'Frank R. Lautenberg', gender: 'M', birth: 1924 },
  { full_name: 'Ralph M. Hall', gender: 'M', birth: 1923 }
];

const chartData = data.map(obj => {
  obj.value = obj.gender === 'M' ? 1 : obj.gender === 'F' ? -1 : 0;

  return obj;
});
const spec = {
  type: 'scatter',
  color: ['#E21818', '#98DFD6'],
  data: [
    {
      id: 'scatter',
      values: chartData
    }
  ],
  xField: 'birth',
  yField: 'value',
  seriesField: 'gender',
  stack: true,
  axes: [
    {
      orient: 'left',
      domainLine: {
        visible: false
      },
      title: {
        visible: true,
        text: '← Women · Men →'
      },
      grid: {
        style: {
          lineDash: [0]
        }
      },
      tick: {
        inside: true,
        tickSize: 6,
        tickStep: 5,
        style: {
          stroke: '#000'
        }
      }
    },
    {
      orient: 'bottom',
      domainLine: {
        onZero: true,
        style: {
          stroke: '#000'
        }
      },
      tick: {
        tickSize: 6,
        style: {
          stroke: '#000'
        }
      }
    }
  ],
  tooltip: {
    dimension: { visible: false }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### Zebra line configuration

We can achieve the common zebra line effect by setting `grid.alternateColor`.

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'line',
      values: [
        {
          group: 'All Survey Responses',
          type: 'All Survey Responses',
          opinion: 'Disagree',
          value: -3.7
        },
        {
          group: 'All Survey Responses',
          type: 'All Survey Responses',
          opinion: 'Strongly Disagree',
          value: -0.7
        },
        {
          group: 'All Survey Responses',
          type: 'All Survey Responses',
          opinion: 'No Opinion',
          value: 4.8
        },
        {
          group: 'All Survey Responses',
          type: 'All Survey Responses',
          opinion: 'Agree',
          value: 40.7
        },
        {
          group: 'All Survey Responses',
          type: 'All Survey Responses',
          opinion: 'Strongly Agree',
          value: 50.1
        },
        {
          group: 'Employment sector',
          type: 'Academic(nonstudent)',
          opinion: 'Disagree',
          value: -2
        },
        {
          group: 'Employment sector',
          type: 'Academic(nonstudent)',
          opinion: 'Strongly Disagree',
          value: 0
        },
        {
          group: 'Employment sector',
          type: 'Academic(nonstudent)',
          opinion: 'No Opinion',
          value: 3.2
        },
        {
          group: 'Employment sector',
          type: 'Academic(nonstudent)',
          opinion: 'Agree',
          value: 30.8
        },
        {
          group: 'Employment sector',
          type: 'Academic(nonstudent)',
          opinion: 'Strongly Agree',
          value: 64
        },
        {
          group: 'Employment sector',
          type: 'Business and industry',
          opinion: 'Disagree',
          value: -6.3
        },
        {
          group: 'Employment sector',
          type: 'Business and industry',
          opinion: 'Strongly Disagree',
          value: 0
        },
        {
          group: 'Employment sector',
          type: 'Business and industry',
          opinion: 'No Opinion',
          value: 2.8
        },
        {
          group: 'Employment sector',
          type: 'Business and industry',
          opinion: 'Agree',
          value: 50
        },
        {
          group: 'Employment sector',
          type: 'Business and industry',
          opinion: 'Strongly Agree',
          value: 40.6
        },
        {
          group: 'Employment sector',
          type: 'Federal, state, and local government',
          opinion: 'Disagree',
          value: -4.2
        },
        {
          group: 'Employment sector',
          type: 'Federal, state, and local government',
          opinion: 'Strongly Disagree',
          value: -2.8
        },
        {
          group: 'Employment sector',
          type: 'Federal, state, and local government',
          opinion: 'No Opinion',
          value: 7
        },
        {
          group: 'Employment sector',
          type: 'Federal, state, and local government',
          opinion: 'Agree',
          value: 47.9
        },
        {
          group: 'Employment sector',
          type: 'Federal, state, and local government',
          opinion: 'Strongly Agree',
          value: 38
        },
        {
          group: 'Employment sector',
          type: 'Private consultant/self-employed',
          opinion: 'Disagree',
          value: 0
        },
        {
          group: 'Employment sector',
          type: 'Private consultant/self-employed',
          opinion: 'Strongly Disagree',
          value: 0
        },
        {
          group: 'Employment sector',
          type: 'Private consultant/self-employed',
          opinion: 'No Opinion',
          value: 7.1
        },
        {
          group: 'Employment sector',
          type: 'Private consultant/self-employed',
          opinion: 'Agree',
          value: 53.6
        },
        {
          group: 'Employment sector',
          type: 'Private consultant/self-employed',
          opinion: 'Strongly Agree',
          value: 39.3
        },
        {
          group: 'Employment sector',
          type: 'Other',
          opinion: 'Disagree',
          value: -5.9
        },
        {
          group: 'Employment sector',
          type: 'Other',
          opinion: 'Strongly Disagree',
          value: -5.9
        },
        {
          group: 'Employment sector',
          type: 'Other',
          opinion: 'No Opinion',
          value: 14.7
        },
        {
          group: 'Employment sector',
          type: 'Other',
          opinion: 'Agree',
          value: 44.1
        },
        {
          group: 'Employment sector',
          type: 'Other',
          opinion: 'Strongly Agree',
          value: 29.4
        },
        {
          group: 'Race',
          type: 'White',
          opinion: 'Disagree',
          value: -2.8
        },
        {
          group: 'Race',
          type: 'White',
          opinion: 'Strongly Disagree',
          value: -1
        },
        {
          group: 'Race',
          type: 'White',
          opinion: 'No Opinion',
          value: 4.5
        },
        {
          group: 'Race',
          type: 'White',
          opinion: 'Agree',
          value: 41.8
        },
        {
          group: 'Race',
          type: 'White',
          opinion: 'Strongly Agree',
          value: 50
        },
        {
          group: 'Race',
          type: 'Asian',
          opinion: 'Disagree',
          value: -3.3
        },
        {
          group: 'Race',
          type: 'Asian',
          opinion: 'Strongly Disagree',
          value: 0
        },
        {
          group: 'Race',
          type: 'Asian',
          opinion: 'No Opinion',
          value: 3.3
        },
        {
          group: 'Race',
          type: 'Asian',
          opinion: 'Agree',
          value: 40.2
        },
        {
          group: 'Race',
          type: 'Asian',
          opinion: 'Strongly Agree',
          value: 53.3
        },
        {
          group: 'Race',
          type: 'Black or African American',
          opinion: 'Disagree',
          value: -10
        },
        {
          group: 'Race',
          type: 'Black or African American',
          opinion: 'Strongly Disagree',
          value: 0
        },
        {
          group: 'Race',
          type: 'Black or African American',
          opinion: 'No Opinion',
          value: 20
        },
        {
          group: 'Race',
          type: 'Black or African American',
          opinion: 'Agree',
          value: 30
        },
        {
          group: 'Race',
          type: 'Black or African American',
          opinion: 'Strongly Agree',
          value: 40
        },
        {
          group: 'Education',
          type: "Associate's and Bachelor's",
          opinion: 'Disagree',
          value: -6.9
        },
        {
          group: 'Education',
          type: "Associate's and Bachelor's",
          opinion: 'Strongly Disagree',
          value: -1.1
        },
        {
          group: 'Education',
          type: "Associate's and Bachelor's",
          opinion: 'No Opinion',
          value: 5.7
        },
        {
          group: 'Education',
          type: "Associate's and Bachelor's",
          opinion: 'Agree',
          value: 49.1
        },
        {
          group: 'Education',
          type: "Associate's and Bachelor's",
          opinion: 'Strongly Agree',
          value: 37.1
        },
        {
          group: 'Education',
          type: "Master's and Above",
          opinion: 'Disagree',
          value: -2.3
        },
        {
          group: 'Education',
          type: "Master's and Above",
          opinion: 'Strongly Disagree',
          value: -0.5
        },
        {
          group: 'Education',
          type: "Master's and Above",
          opinion: 'No Opinion',
          value: 4.4
        },
        {
          group: 'Education',
          type: "Master's and Above",
          opinion: 'Agree',
          value: 36.9
        },
        {
          group: 'Education',
          type: "Master's and Above",
          opinion: 'Strongly Agree',
          value: 55.9
        },
        {
          group: 'Gender',
          type: 'Male',
          opinion: 'Disagree',
          value: -3.4
        },
        {
          group: 'Gender',
          type: 'Male',
          opinion: 'Strongly Disagree',
          value: -0.8
        },
        {
          group: 'Gender',
          type: 'Male',
          opinion: 'No Opinion',
          value: 4.2
        },
        {
          group: 'Gender',
          type: 'Male',
          opinion: 'Agree',
          value: 41
        },
        {
          group: 'Gender',
          type: 'Male',
          opinion: 'Strongly Agree',
          value: 50.6
        },
        {
          group: 'Gender',
          type: 'Female',
          opinion: 'Disagree',
          value: -3.5
        },
        {
          group: 'Gender',
          type: 'Female',
          opinion: 'Strongly Disagree',
          value: -0.5
        },
        {
          group: 'Gender',
          type: 'Female',
          opinion: 'No Opinion',
          value: 6
        },
        {
          group: 'Gender',
          type: 'Female',
          opinion: 'Agree',
          value: 39
        },
        {
          group: 'Gender',
          type: 'Female',
          opinion: 'Strongly Agree',
          value: 51
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  seriesField: 'opinion',
  stack: true,
  color: {
    type: 'ordinal',
    range: ['#e34a33', '#fdbb84', '#bdbdbd', '#addd8e', '#31a354'],
    domain: ['Strongly Disagree', 'Disagree', 'No Opinion', 'Agree', 'Strongly Agree']
  }, // 自定义 color scale
  legends: { visible: true },
  region: [
    {
      style: {
        stroke: '#dfdfdf',
        lineWidth: 1
      }
    }
  ],
  axes: [
    {
      orient: 'left',
      tick: {
        visible: false
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        },
        alternateColor: ['#F2F2F2', '#FFFFFF'],
        alignWithLabel: false // grid 不跟随 label 展示
      }
    },
    {
      orient: 'bottom',
      tick: {
        visible: false,
        tickCount: 10
      },
      min: -100,
      max: 100,
      label: {
        formatMethod: val => `${Math.abs(val)}%`
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### Axis interaction

In the Cartesian coordinate system, the axes support interaction via the `select` and `hover` properties. It displays the response at different interaction states through the style changes of the coordinate axis background area semantic label.

```javascript livedemo
const axisConfig = {
  hover: true, // 开启 hover 交互
  select: true, // 开启 select 交互
  background: {
    visible: true,
    style: {
      fillOpacity: 0
    },
    state: {
      hover: {
        fillOpacity: 0.65,
        fill: '#DDE3E9',
        cursor: 'pointer'
      },
      selected: {
        fillOpacity: 0.65,
        fill: '#9CCBDB',
        cursor: 'pointer'
      }
    }
  },
  label: {
    style: {
      pickable: false // 为了不影响背景的拾取，先把 label 的拾取关闭，即不响应事件
    },
    state: {
      hover_reverse: {
        fill: '#444'
      },
      selected_reverse: {
        fill: '#444'
      }
    }
  }
};

const spec = {
  type: 'area',
  data: [
    {
      id: 'area',
      values: [
        {
          x: '1990',
          y: 110,
          from: 'video ad'
        },
        {
          x: '1995',
          y: 160,
          from: 'video ad'
        },
        {
          x: '2000',
          y: 230,
          from: 'video ad'
        },
        {
          x: '2005',
          y: 300,
          from: 'video ad'
        },
        {
          x: '2010',
          y: 448,
          from: 'video ad'
        },
        {
          x: '2015',
          y: 500,
          from: 'video ad'
        },
        {
          x: '1990',
          y: 120,
          from: 'email marketing'
        },
        {
          x: '1995',
          y: 150,
          from: 'email marketing'
        },
        {
          x: '2000',
          y: 200,
          from: 'email marketing'
        },
        {
          x: '2005',
          y: 210,
          from: 'email marketing'
        },
        {
          x: '2010',
          y: 300,
          from: 'email marketing'
        },
        {
          x: '2015',
          y: 320,
          from: 'email marketing'
        }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'from',
  line: {
    style: {
      curveType: 'monotone'
    }
  },
  area: {
    style: {
      fillOpacity: 1,
      fill: {
        gradient: 'linear',
        x0: 0.5,
        y0: 0,
        x1: 0.5,
        y1: 1,
        stops: [
          {
            offset: 0,
            opacity: 0.2
          },
          {
            offset: 1,
            opacity: 0
          }
        ]
      }
    }
  },
  axes: [
    {
      orient: 'bottom',
      ...axisConfig
    },
    {
      orient: 'left',
      ...axisConfig
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```
