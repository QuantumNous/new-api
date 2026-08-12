# Histogram

[\[Configuration Manual\]](../../../option/histogramChart)

## Introduction

Histogram, also known as a quality distribution chart, is used to represent the distribution of data, and is a common statistical chart. The horizontal axis generally represents the data range, the vertical axis represents the distribution, and the higher the column, the larger the number of elements in that range.

## Chart Structure

The histogram is composed of rectangular elements, coordinate axes, and other components.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a05.png)

The rectangle element is the basic element of the histogram, and the relevant drawing configuration is indispensable:

- `histogramChart.type`: Chart type, the type of histogram is `'histogram'`
- `histogramChart.data`: Data source for chart drawing
- `histogramChart.xField`: Numeric field, mapping the x-coordinate / width of the element
- `histogramChart.x1Field`: Numeric field, mapping the x1-coordinate of the element
- `histogramChart.yField`: Numeric field, mapping the y-coordinate / height of the element
- `histogramChart.y1Field`: Numeric field, mapping the y1-coordinate of the element

  Like other charts, the histogram supports the configuration of the `direction` attribute. When `direction: 'horizontal'`, `xField` maps the width of the rectangle element, `yField` and `y1Field` map the upper and lower boundaries of the rectangle element. Coordinates, i.e., y and y1 coordinates; when `direction: 'vertical'`, `yField` maps the height of the rectangle element, `xField` and `x1Field` map the left and right boundaries of the rectangle element. Coordinates, namely x and x1 coordinates.

Coordinate axes, tooltips, and other components that assist chart display are optional configuration, with default effects and functionality:

- `histogramChart.axes`: Coordinate axis component, displayed by default, and automatically infers coordinate system and data mapping logic according to chart type. Note that histograms do not support discrete axes because they are used to statistically analyze the frequency distribution within each data range, and the main axis(values) must be entered as a value range, which isn't supported by the discrete axis. Detailed configuration can be found at [VChart coordinate axis component configuration](../../../option/histogramChart#axes)
- `histogramChart.tooltip`: Tooltip, displayed by default during interaction, detailed configuration can be found at [VChart tooltip component configuration](../../../option/histogramChart#tooltip)
- For more component configuration see [VChart histogramChart configuration](../../../option/histogramChart)

## Getting Started

```javascript livedemo
const spec = {
  data: [
    {
      name: 'data1',
      values: [
        {
          x0: -400,
          x1: -380,
          frequency: 0
        },
        {
          x0: -380,
          x1: -360,
          frequency: 4
        },
        {
          x0: -360,
          x1: -340,
          frequency: 7
        },
        {
          x0: -340,
          x1: -320,
          frequency: 7
        },
        {
          x0: -320,
          x1: -300,
          frequency: 18
        },
        {
          x0: -300,
          x1: -280,
          frequency: 30
        },
        {
          x0: -280,
          x1: -260,
          frequency: 33
        },
        {
          x0: -260,
          x1: -240,
          frequency: 80
        },
        {
          x0: -240,
          x1: -220,
          frequency: 98
        },
        {
          x0: -220,
          x1: -200,
          frequency: 124
        },
        {
          x0: -200,
          x1: -180,
          frequency: 161
        },
        {
          x0: -180,
          x1: -160,
          frequency: 176
        },
        {
          x0: -160,
          x1: -140,
          frequency: 227
        },
        {
          x0: -140,
          x1: -120,
          frequency: 276
        },
        {
          x0: -120,
          x1: -100,
          frequency: 321
        },
        {
          x0: -100,
          x1: -80,
          frequency: 452
        },
        {
          x0: -80,
          x1: -60,
          frequency: 441
        },
        {
          x0: -60,
          x1: -40,
          frequency: 505
        },
        {
          x0: -40,
          x1: -20,
          frequency: 521
        },
        {
          x0: -20,
          x1: 0,
          frequency: 733
        },
        {
          x0: 0,
          x1: 20,
          frequency: 892
        },
        {
          x0: 20,
          x1: 40,
          frequency: 362
        },
        {
          x0: 40,
          x1: 60,
          frequency: 267
        },
        {
          x0: 60,
          x1: 80,
          frequency: 223
        },
        {
          x0: 80,
          x1: 100,
          frequency: 157
        },
        {
          x0: 100,
          x1: 120,
          frequency: 170
        },
        {
          x0: 120,
          x1: 140,
          frequency: 124
        },
        {
          x0: 140,
          x1: 160,
          frequency: 112
        },
        {
          x0: 160,
          x1: 180,
          frequency: 73
        },
        {
          x0: 180,
          x1: 200,
          frequency: 80
        },
        {
          x0: 200,
          x1: 220,
          frequency: 49
        },
        {
          x0: 220,
          x1: 240,
          frequency: 33
        },
        {
          x0: 240,
          x1: 260,
          frequency: 30
        },
        {
          x0: 260,
          x1: 280,
          frequency: 21
        },
        {
          x0: 280,
          x1: 300,
          frequency: 9
        },
        {
          x0: 300,
          x1: 320,
          frequency: 13
        },
        {
          x0: 320,
          x1: 340,
          frequency: 11
        },
        {
          x0: 340,
          x1: 360,
          frequency: 5
        },
        {
          x0: 360,
          x1: 380,
          frequency: 4
        },
        {
          x0: 380,
          x1: 400,
          frequency: 4
        },
        {
          x0: 400,
          x1: 420,
          frequency: 2
        },
        {
          x0: 420,
          x1: 440,
          frequency: 8
        },
        {
          x0: 440,
          x1: 460,
          frequency: 2
        },
        {
          x0: 460,
          x1: 480,
          frequency: 3
        },
        {
          x0: 480,
          x1: 500,
          frequency: 10
        },
        {
          x0: 500,
          x1: 520,
          frequency: 7
        },
        {
          x0: 520,
          x1: 540,
          frequency: 14
        },
        {
          x0: 540,
          x1: 560,
          frequency: 6
        },
        {
          x0: 560,
          x1: 580,
          frequency: 1
        },
        {
          x0: 580,
          x1: 600,
          frequency: 3
        },
        {
          x0: 600,
          x1: 620,
          frequency: 0
        },
        {
          x0: 620,
          x1: 640,
          frequency: 6
        },
        {
          x0: 640,
          x1: 660,
          frequency: 5
        },
        {
          x0: 660,
          x1: 680,
          frequency: 3
        },
        {
          x0: 680,
          x1: 700,
          frequency: 2
        },
        {
          x0: 700,
          x1: 720,
          frequency: 0
        }
      ]
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'frequency',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Arrival Time Histogram',
    textStyle: {
      height: 50,
      lineWidth: 3,
      fill: '#333',
      fontSize: 25,
      fontFamily: 'Times New Roman'
    },
    subtextStyle: {
      character: [
        {
          text: 'This histogram details the distribution of the number of seconds the arrival of tram line 1 of Amsterdam on 2 October 2017 deviated from the planning on each stop in each trip.\nThe data was filtered to remove 4 extreme measurements from ~7000 datapoints that caused significant skewing.',
          fontFamily: 'Times New Roman',
          fontSize: 14,
          fill: '#333'
        },
        {
          text: '\ndata source: https://observablehq.com/@nickrttn/departure-time-histogram',
          fontSize: 10,
          fill: '#333',
          fillOpacity: 0.5
        }
      ]
    }
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'frequency'
      },
      content: [
        {
          key: datum => datum['x0'] + '～' + datum['x1'],
          value: datum => datum['frequency']
        }
      ]
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Key Configuration

- Declare the `xField` property as the frequency statistics left range field
- Declare the `x2Field` property as the frequency statistics right range field
- Declare the `yField` property as the frequency value field

## Histogram Features

Unlike bar charts, histograms display data within a specific segment, so the dimension axis usually requires two fields to represent the start and end points of the interval. Moreover, since the interval is a value range, the dimension axis is a continuous axis. The index axis uses a numeric field to represent column height.

### Data

- Two `numeric` fields, such as: `x` `x1`
- One `numeric` field, such as: `value`

Data definition is as follows:

```ts
data: [
  {
    name: 'histogram',
    values: [
      {
        x: 0,
        x1: 10,
        value: 1
      },
      {
        x: 10,
        x1: 20,
        value: 5
      },
      {
        x: 20,
        x1: 30,
        value: 2
      }
    ]
  }
];
```

### Histogram Line Combination Chart

Histograms and line charts are often used together to provide clearer and more accurate visualizations of data distribution characteristics. Compared to a single histogram, a histogram paired with a line chart not only intuitively displays data distribution in the chart, but also better emphasizes data trends and deviation changes.

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        {
          x0: -400,
          x1: -380,
          frequency: 0
        },
        {
          x0: -380,
          x1: -360,
          frequency: 4
        },
        {
          x0: -360,
          x1: -340,
          frequency: 7
        },
        {
          x0: -340,
          x1: -320,
          frequency: 7
        },
        {
          x0: -320,
          x1: -300,
          frequency: 18
        },
        {
          x0: -300,
          x1: -280,
          frequency: 30
        },
        {
          x0: -280,
          x1: -260,
          frequency: 33
        },
        {
          x0: -260,
          x1: -240,
          frequency: 80
        },
        {
          x0: -240,
          x1: -220,
          frequency: 98
        },
        {
          x0: -220,
          x1: -200,
          frequency: 124
        },
        {
          x0: -200,
          x1: -180,
          frequency: 161
        },
        {
          x0: -180,
          x1: -160,
          frequency: 176
        },
        {
          x0: -160,
          x1: -140,
          frequency: 227
        },
        {
          x0: -140,
          x1: -120,
          frequency: 276
        },
        {
          x0: -120,
          x1: -100,
          frequency: 321
        },
        {
          x0: -100,
          x1: -80,
          frequency: 452
        },
        {
          x0: -80,
          x1: -60,
          frequency: 441
        },
        {
          x0: -60,
          x1: -40,
          frequency: 505
        },
        {
          x0: -40,
          x1: -20,
          frequency: 521
        },
        {
          x0: -20,
          x1: 0,
          frequency: 733
        },
        {
          x0: 0,
          x1: 20,
          frequency: 892
        },
        {
          x0: 20,
          x1: 40,
          frequency: 362
        },
        {
          x0: 40,
          x1: 60,
          frequency: 267
        },
        {
          x0: 60,
          x1: 80,
          frequency: 223
        },
        {
          x0: 80,
          x1: 100,
          frequency: 157
        },
        {
          x0: 100,
          x1: 120,
          frequency: 170
        },
        {
          x0: 120,
          x1: 140,
          frequency: 124
        },
        {
          x0: 140,
          x1: 160,
          frequency: 112
        },
        {
          x0: 160,
          x1: 180,
          frequency: 73
        },
        {
          x0: 180,
          x1: 200,
          frequency: 80
        },
        {
          x0: 200,
          x1: 220,
          frequency: 49
        },
        {
          x0: 220,
          x1: 240,
          frequency: 33
        },
        {
          x0: 240,
          x1: 260,
          frequency: 30
        },
        {
          x0: 260,
          x1: 280,
          frequency: 21
        },
        {
          x0: 280,
          x1: 300,
          frequency: 9
        },
        {
          x0: 300,
          x1: 320,
          frequency: 13
        },
        {
          x0: 320,
          x1: 340,
          frequency: 11
        },
        {
          x0: 340,
          x1: 360,
          frequency: 5
        },
        {
          x0: 360,
          x1: 380,
          frequency: 4
        },
        {
          x0: 380,
          x1: 400,
          frequency: 4
        },
        {
          x0: 400,
          x1: 420,
          frequency: 2
        },
        {
          x0: 420,
          x1: 440,
          frequency: 8
        },
        {
          x0: 440,
          x1: 460,
          frequency: 2
        },
        {
          x0: 460,
          x1: 480,
          frequency: 3
        },
        {
          x0: 480,
          x1: 500,
          frequency: 10
        },
        {
          x0: 500,
          x1: 520,
          frequency: 7
        },
        {
          x0: 520,
          x1: 540,
          frequency: 14
        },
        {
          x0: 540,
          x1: 560,
          frequency: 6
        },
        {
          x0: 560,
          x1: 580,
          frequency: 1
        },
        {
          x0: 580,
          x1: 600,
          frequency: 3
        },
        {
          x0: 600,
          x1: 620,
          frequency: 0
        },
        {
          x0: 620,
          x1: 640,
          frequency: 6
        },
        {
          x0: 640,
          x1: 660,
          frequency: 5
        },
        {
          x0: 660,
          x1: 680,
          frequency: 3
        },
        {
          x0: 680,
          x1: 700,
          frequency: 2
        },
        {
          x0: 700,
          x1: 720,
          frequency: 0
        }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      dataIndex: 0,
      xField: 'x0',
      x2Field: 'x1',
      yField: 'frequency'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 0,
      seriesField: 'type',
      xField: 'x0',
      yField: 'frequency',
      stack: false,
      point: {
        visible: false
      },
      line: {
        style: {
          strokeWidth: 2
        }
      }
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

### Different Frequency Distribution Histogram

Since the left and right boundary positions of the columns are determined by different data fields, this means that the size of the data intervals determines the column width (or column height when `direction: 'horizontal'`). Different data intervals can be drawn to form histograms with different frequency distributions.

```javascript livedemo
const spec = {
  type: 'histogram',
  xField: 'from',
  x2Field: 'to',
  yField: 'profit',
  seriesField: 'type',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Profit',
    padding: {
      bottom: 20
    },
    textStyle: {
      align: 'center',
      height: 50,
      lineWidth: 3,
      fill: '#333',
      fontSize: 25,
      fontFamily: 'Times New Roman'
    }
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'profit'
      },
      content: [
        {
          key: datum => datum['from'] + '～' + datum['to'],
          value: datum => datum['profit']
        }
      ]
    }
  },
  data: [
    {
      name: 'data1',
      values: [
        {
          from: 0,
          to: 10,
          profit: 2,
          type: 'A'
        },
        {
          from: 10,
          to: 16,
          profit: 3,
          type: 'B'
        },
        {
          from: 16,
          to: 18,
          profit: 15,
          type: 'C'
        },
        {
          from: 18,
          to: 26,
          profit: 12,
          type: 'D'
        },
        {
          from: 26,
          to: 32,
          profit: 22,
          type: 'E'
        },
        {
          from: 32,
          to: 56,
          profit: 7,
          type: 'F'
        },
        {
          from: 56,
          to: 62,
          profit: 17,
          type: 'G'
        }
      ]
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Generating Histogram Data Using the `bin` Transform

Since version `2.0.7`, histograms support the `bin` transform. When your data is in a detailed (raw) format, you can use this transform to generate standard histogram data.

```javascript livedemo
const spec = {
  data: [
    {
      name: 'data1',
      transforms: [
        {
          type: 'bin',
          options: {
            bins: 10,
            field: 'value'
          }
        }
      ],
      values: [
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 2.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 },
        { value: 9.3 }
      ]
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'count',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Arrival Time Histogram'
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'count'
      },
      content: [
        {
          key: datum => datum['x0'] + '～' + datum['x1'],
          value: datum => datum['count']
        }
      ]
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// For debugging purposes only, do not copy
window['vchart'] = vchart;
```

The `bin` transform supports the following configuration options:

```ts
interface IBinOptions {
  /**
   * The numeric field to be binned
   */
  field: string;
  /**
   * Number of bins (default is 10)
   */
  bins?: number;
  /**
   * Explicitly specified array of bin boundaries
   */
  thresholds?: number[];
  /**
   * Fixed bin width (interval step); overrides bins if set
   */
  step?: number;
  /**
   * Specify the minimum and maximum values for binning [min, max]; otherwise, calculated automatically from the data
   */
  extent?: [number, number];
  /**
   * Whether to retain original data items in each bin
   */
  includeValues?: boolean;
  /**
   * Field name mapping for the output data
   */
  outputNames?: { x0?: string; x1?: string; count?: string; values?: string };
}
```

## Chart Layout

### Stacked Histogram

In VChart, to display a stacked histogram, set `histogramChart.stack: true`, and to distinguish columns stacked under the same dimension, specify `histogramChart.seriedField`. This field defaults to mapping the area color.

```javascript livedemo
const spec = {
  color: ['#1ac7c2', '#ccf59a'],
  data: [
    {
      name: 'data1',
      values: [
        {
          year: 2000,
          age0: 0,
          age1: 5,
          people: 9735380,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 5,
          age1: 10,
          people: 10552146,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 10,
          age1: 15,
          people: 10563233,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 15,
          age1: 20,
          people: 10237419,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 20,
          age1: 25,
          people: 9731315,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 25,
          age1: 30,
          people: 9659493,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 30,
          age1: 35,
          people: 10205879,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 35,
          age1: 40,
          people: 11475182,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 40,
          age1: 45,
          people: 11320252,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 45,
          age1: 50,
          people: 9925006,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 50,
          age1: 55,
          people: 8507934,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 55,
          age1: 60,
          people: 6459082,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 60,
          age1: 65,
          people: 5123399,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 65,
          age1: 70,
          people: 4453623,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 70,
          age1: 75,
          people: 3792145,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 75,
          age1: 80,
          people: 2912655,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 80,
          age1: 85,
          people: 1902638,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 85,
          age1: 90,
          people: 970357,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 90,
          age1: 95,
          people: 336303,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 0,
          age1: 5,
          people: 9310714,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 5,
          age1: 10,
          people: 10069564,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 10,
          age1: 15,
          people: 10022524,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 15,
          age1: 20,
          people: 9692669,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 20,
          age1: 25,
          people: 9324244,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 25,
          age1: 30,
          people: 9518507,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 30,
          age1: 35,
          people: 10119296,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 35,
          age1: 40,
          people: 11635647,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 40,
          age1: 45,
          people: 11488578,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 45,
          age1: 50,
          people: 10261253,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 50,
          age1: 55,
          people: 8911133,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 55,
          age1: 60,
          people: 6921268,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 60,
          age1: 65,
          people: 5668961,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 65,
          age1: 70,
          people: 4804784,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 70,
          age1: 75,
          people: 5184855,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 75,
          age1: 80,
          people: 4355644,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 80,
          age1: 85,
          people: 3221898,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 85,
          age1: 90,
          people: 1981156,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 90,
          age1: 95,
          people: 1064581,
          sex: 'Male'
        }
      ]
    }
  ],
  type: 'histogram',
  xField: 'age0',
  x2Field: 'age1',
  yField: 'people',
  seriesField: 'sex',
  legends: {},
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'A trellis bar chart showing the US population distribution of age groups and gender in 2000.',
    textStyle: {
      height: 50,
      lineWidth: 2,
      fill: '#333',
      fontSize: 18,
      fontFamily: 'Times New Roman'
    }
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: datum => datum['sex']
      },
      content: [
        {
          key: datum => datum['age0'] + '～' + datum['age1'],
          value: datum => datum['people']
        }
      ]
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
