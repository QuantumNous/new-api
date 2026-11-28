# Box Plot

[\[Configuration Manual\]](../../../option/boxPlotChart)

## Introduction

A box plot (English: box plot), also known as a box-whisker plot, box chart, box plot, or box-line chart, is a statistical chart used to display the dispersion of a data set. It is named because the shape of the chart is like a box and there are often lines extending around the upper and lower quartiles like whiskers. It is mainly used to reflect the distribution characteristics of raw data and can also be used to compare the distribution characteristics of multiple groups of data. It can display the maximum value, minimum value, median and upper and lower quartiles of a set of data. When there is a value that is different from the range of 1.5×IQR above the upper and lower quartiles, that value is an outlier. Outlier values are sometimes drawn as individual points.

## Chart Composition

Box plots are made up of box plot elements (box plot elements are a special type of chart element, based on the [VGrammr Glyph chart element](../../../../vgrammar/guide/guides/mark/mark-glyph) packaging) and other components.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf05.png)

The box plot element is the basic element of a box plot. To draw a complete box plot element, the following drawing configurations are essential:

- `boxPlotChart.type`: Chart type, the type of box plot is `'boxPlot'`
- `boxPlotChart.data`: Data source for chart drawing
- `boxPlotChart.xField`: x-axis field, when `direction: 'vertical'`, maps the x-coordinate of the chart element
- `boxPlotChart.yField`: y-axis field, when `direction: 'horizontal'`, maps the y-coordinate of the chart element
- `boxPlotChart.minField`: Numeric field, representing the minimum value of the data, mapping the lower border line of the box plot element
- `boxPlotChart.q1Field`: Numeric field, representing the lower quartile value of the data, mapping the lower border of the box plot element box
- `boxPlotChart.medianField`: Numeric field, representing the median value of the data, mapping the middle line of the box plot element box
- `boxPlotChart.q3Field`: Numeric field, representing the upper quartile of the data, mapping the upper border of the box plot element box
- `boxPlotChart.maxField`: Numeric field, representing the maximum value of the data, mapping the upper border line of the box plot element

Components such as coordinate axes and tooltips, which help present the chart, are optional configurations with built-in default effects and functions:

- `boxPlotChart.axes`: Coordinate axis component, displayed by default and automatically infers coordinate system and data mapping logic based on chart type; note that histogram does not support discrete axes, as histogram is used to display frequency distribution within data ranges, so the main axis must be input in the form of value ranges; discrete axes do not support this feature. For detailed configuration, see [VChart Coordinate Axis Component Configuration](../../../option/boxPlotChart#axes)
- `boxPlotChart.tooltip`: Tooltip information, displayed by default when interacting; for detailed configuration, see [VChart Tooltip Information Component Configuration](../../../option/boxPlotChart#tooltip)
- For more component configurations, see [VChart boxPlotChart configuration](../../../option/boxPlotChart)

## Quick Start

```javascript livedemo
const data = [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'Sub-Saharan Africa',
        y1: 8.72,
        y2: 9.73,
        y3: 10.17,
        y4: 10.51,
        y5: 11.64
      },
      {
        x: 'South Asia',
        y1: 9.4,
        y2: 10.06,
        y3: 10.75,
        y4: 11.56,
        y5: 12.5
      },
      {
        x: 'Middle East & North Africa',
        y1: 9.54,
        y2: 10.6,
        y3: 11.05,
        y4: 11.5,
        y5: 11.92
      },
      {
        x: 'Latin America & Caribbean',
        y1: 8.74,
        y2: 9.46,
        y3: 10.35,
        y4: 10.94,
        y5: 12.21
      },
      {
        x: 'East Asia & Pacific',
        y1: 7.8,
        y2: 8.95,
        y3: 10.18,
        y4: 11.57,
        y5: 13.25
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.52,
        y2: 10.39,
        y3: 10.93,
        y4: 11.69,
        y5: 12.63
      }
    ]
  }
];

const spec = {
  type: 'boxPlot',
  data: data,
  xField: 'x',

  minField: 'y1',
  q1Field: 'y2',
  medianField: 'y3',
  q3Field: 'y4',
  maxField: 'y5',
  direction: 'vertical'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Key Configuration

- Set the `direction` property to `'vertical'`
- `minField`, `q1Field`, `medianField`, `q3Field`, and `maxField` separately declare the minimum value, lower quartile, median, upper quartile, and maximum value fields in the data

## Box Plot Features

### Data

- One `discrete` field, e.g., `x`
- Five `numeric` fields, e.g., `y1` `y2` `y3` `y4` `y5`

Data is defined as follows:

```ts
data: [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'A',
        y1: 5,
        y2: 8,
        y3: 10,
        y4: 12,
        y5: 20
      },
      {
        x: 'B',
        y1: 5,
        y2: 8,
        y3: 10,
        y4: 12,
        y5: 20
      },
      {
        x: 'C',
        y1: 5,
        y2: 8,
        y3: 10,
        y4: 12,
        y5: 20
      }
    ]
  }
];
```

### Layout

#### Grouped Box Plot

Similar to a grouped bar chart, a grouped box plot can be thought of as a combination of different box plot series arranged with intervals, each group of box plot series representing a category.
In VChart, you need to add a field to `xField` (at this point,`xField` is in array form), which is used to differentiate data categories, i.e., to split the box plot of the same dimension into several groups and spread them out in an interval arrangement. And to distinguish the interval arrangement of the box plot under the same dimension, you need to specify the `boxplotChart.seriedField` field, which, by default, maps the color of the box plot element.

```javascript livedemo
const data = [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'Sub-Saharan Africa',
        y1: 9.16270124,
        y2: 10.07530816,
        y3: 10.09027907,
        y4: 10.27579542,
        y5: 11.62222959,
        group: 'High income'
      },
      {
        x: 'Sub-Saharan Africa',
        y1: 8.721525214,
        y2: 9.641352839,
        y3: 10.1736233,
        y4: 10.57169914,
        y5: 11.64427467,
        group: 'Low income'
      },
      {
        x: 'South Asia',
        y1: 9.404757278,
        y2: 10.36482449,
        y3: 10.94903493,
        y4: 11.5806383,
        y5: 12.50192084,
        group: 'Low income'
      },
      {
        x: 'South Asia',
        y1: 9.732841997,
        y2: 9.732841997,
        y3: 9.732841997,
        y4: 9.732841997,
        y5: 9.732841997,
        group: 'High income'
      },
      {
        x: 'Middle East & North Africa',
        y1: 9.541951901,
        y2: 10.33719892,
        y3: 10.91206173,
        y4: 11.29821858,
        y5: 11.60653481,
        group: 'Low income'
      },
      {
        x: 'Middle East & North Africa',
        y1: 10.2396509,
        y2: 10.63879995,
        y3: 11.09996104,
        y4: 11.54301107,
        y5: 11.92092709,
        group: 'High income'
      },
      {
        x: 'Latin America & Caribbean',
        y1: 10.14653181,
        y2: 10.32106777,
        y3: 10.45467215,
        y4: 10.45844052,
        y5: 10.6064696,
        group: 'Low income'
      },
      {
        x: 'Latin America & Caribbean',
        y1: 8.743652009,
        y2: 9.413881158,
        y3: 10.16606248,
        y4: 11.00011805,
        y5: 12.20655104,
        group: 'High income'
      },
      {
        x: 'East Asia & Pacific',
        y1: 7.800035977,
        y2: 8.850646235,
        y3: 10.14633178,
        y4: 11.59877618,
        y5: 13.24880824,
        group: 'High income'
      },
      {
        x: 'East Asia & Pacific',
        y1: 8.316035904,
        y2: 9.038602613,
        y3: 10.22954548,
        y4: 10.71782871,
        y5: 12.07411874,
        group: 'Low income'
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.831631935,
        y2: 9.939275167,
        y3: 10.39108655,
        y4: 10.95556656,
        y5: 11.3012157,
        group: 'Low income'
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.522480948,
        y2: 10.43085982,
        y3: 11.06642694,
        y4: 11.73822523,
        y5: 12.62940296,
        group: 'High income'
      }
    ]
  }
];

const spec = {
  type: 'boxPlot',
  data: data,
  xField: ['x', 'group'],

  minField: 'y1',
  q1Field: 'y2',
  medianField: 'y3',
  q3Field: 'y4',
  maxField: 'y5',
  seriesField: 'group',

  direction: 'vertical',
  color: ['#62CDFF', '#9E4784'],

  legends: [{ visible: true, position: 'middle', orient: 'top' }],

  title: {
    visible: true,
    text: 'Global GDP 2021'
  },

  boxPlot: {
    style: {
      // 不指定则自适应宽度
      // boxWidth: 50,
      // shaftWidth: 60,
      shaftShape: 'line',
      lineWidth: 2
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Chart Elements and Styles

#### Main Configuration

| Keyword      | Description                      | Default Value |
| ------------ | -------------------------------- | ------------- |
| boxWidth     | Box body width                   |               |
| shaftShape   | Chart element shape              | 'line'        |
| shaftWidth   | Maximum and minimum width        |               |
| shaftOpacity | Maximum and minimum transparency |               |
| lineWidth    | Chart element stroke width       |               |

#### Width Adaptation

The width of the box plot chart element is adaptive by default. If you need a fixed box body width, you can configure a specific value in`boxPlotChart.boxPlot.style.boxWidth`.

```javascript livedemo
const data = [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'Sub-Saharan Africa',
        y1: 8.72,
        y2: 9.73,
        y3: 10.17,
        y4: 10.51,
        y5: 11.64
      },
      {
        x: 'South Asia',
        y1: 9.4,
        y2: 10.06,
        y3: 10.75,
        y4: 11.56,
        y5: 12.5
      },
      {
        x: 'Middle East & North Africa',
        y1: 9.54,
        y2: 10.6,
        y3: 11.05,
        y4: 11.5,
        y5: 11.92
      },
      {
        x: 'Latin America & Caribbean',
        y1: 8.74,
        y2: 9.46,
        y3: 10.35,
        y4: 10.94,
        y5: 12.21
      },
      {
        x: 'East Asia & Pacific',
        y1: 7.8,
        y2: 8.95,
        y3: 10.18,
        y4: 11.57,
        y5: 13.25
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.52,
        y2: 10.39,
        y3: 10.93,
        y4: 11.69,
        y5: 12.63
      }
    ]
  }
];

const spec = {
  type: 'boxPlot',
  data: data,
  xField: 'x',

  minField: 'y1',
  q1Field: 'y2',
  medianField: 'y3',
  q3Field: 'y4',
  maxField: 'y5',
  direction: 'vertical',
  boxPlot: {
    style: {
      boxWidth: 20 // 不指定则自适应宽度
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Chart Element Shape

The box plot chart element shape is divided into 'bar' and 'line', 'line' means the chart element is only outlined, and 'bar' means the chart element is only filled. By default, it is set to 'line'. You can specify it by setting`boxPlotChart.boxPlot.style.shaftShape`.

```javascript livedemo
const data = [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'Sub-Saharan Africa',
        y1: 9.16270124,
        y2: 10.07530816,
        y3: 10.09027907,
        y4: 10.27579542,
        y5: 11.62222959,
        group: 'High income'
      },
      {
        x: 'Sub-Saharan Africa',
        y1: 8.721525214,
        y2: 9.641352839,
        y3: 10.1736233,
        y4: 10.57169914,
        y5: 11.64427467,
        group: 'Low income'
      },
      {
        x: 'South Asia',
        y1: 9.404757278,
        y2: 10.36482449,
        y3: 10.94903493,
        y4: 11.5806383,
        y5: 12.50192084,
        group: 'Low income'
      },
      {
        x: 'South Asia',
        y1: 9.732841997,
        y2: 9.732841997,
        y3: 9.732841997,
        y4: 9.732841997,
        y5: 9.732841997,
        group: 'High income'
      },
      {
        x: 'Middle East & North Africa',
        y1: 9.541951901,
        y2: 10.33719892,
        y3: 10.91206173,
        y4: 11.29821858,
        y5: 11.60653481,
        group: 'Low income'
      },
      {
        x: 'Middle East & North Africa',
        y1: 10.2396509,
        y2: 10.63879995,
        y3: 11.09996104,
        y4: 11.54301107,
        y5: 11.92092709,
        group: 'High income'
      },
      {
        x: 'Latin America & Caribbean',
        y1: 10.14653181,
        y2: 10.32106777,
        y3: 10.45467215,
        y4: 10.45844052,
        y5: 10.6064696,
        group: 'Low income'
      },
      {
        x: 'Latin America & Caribbean',
        y1: 8.743652009,
        y2: 9.413881158,
        y3: 10.16606248,
        y4: 11.00011805,
        y5: 12.20655104,
        group: 'High income'
      },
      {
        x: 'East Asia & Pacific',
        y1: 7.800035977,
        y2: 8.850646235,
        y3: 10.14633178,
        y4: 11.59877618,
        y5: 13.24880824,
        group: 'High income'
      },
      {
        x: 'East Asia & Pacific',
        y1: 8.316035904,
        y2: 9.038602613,
        y3: 10.22954548,
        y4: 10.71782871,
        y5: 12.07411874,
        group: 'Low income'
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.831631935,
        y2: 9.939275167,
        y3: 10.39108655,
        y4: 10.95556656,
        y5: 11.3012157,
        group: 'Low income'
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.522480948,
        y2: 10.43085982,
        y3: 11.06642694,
        y4: 11.73822523,
        y5: 12.62940296,
        group: 'High income'
      }
    ]
  }
];

const spec = {
  type: 'boxPlot',
  data: data,
  xField: ['x', 'group'],

  minField: 'y1',
  q1Field: 'y2',
  medianField: 'y3',
  q3Field: 'y4',
  maxField: 'y5',
  seriesField: 'group',

  direction: 'vertical',
  color: ['#BBD6B8', '#EA5455'],

  legends: [{ visible: true, position: 'middle', orient: 'top' }],

  title: {
    visible: true,
    text: 'Global GDP 2021'
  },

  boxPlot: {
    style: {
      boxWidth: 50,
      shaftWidth: 30,
      shaftShape: 'bar',
      lineWidth: 2,
      shaftOpacity: 0.3
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
