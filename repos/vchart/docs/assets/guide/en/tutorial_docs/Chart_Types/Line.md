# Line Chart

[\[Configuration Manual\]](../../../option/lineChart)

## Introduction

A line chart is constructed by connecting a series of data points to reveal trends. Line charts are used to analyze the trends of things changing over time or sequential categories. If there is more than one group of data, a line chart can be used to analyze the interaction and impact of multiple data groups changing over time or categorical sequences. The direction of the line chart indicates positive/negative changes, and the slope of the line chart indicates the degree of change.

In VChart, you can display the data trends of different categories through [Line Chart Configuration](../../../option/lineChart). As shown in the example below, it displays the changing trend of cigarette consumption in developed countries:
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523215.png)

In the [Line Chart Example](../../../demo/line-chart/multi-line) shown above, you need to use the following key configurations:

- `seriesField` property is used to declare the field involved in color mapping
- `legends` property is used for configuring the legend

## Chart Composition

Line charts are composed of point elements, line elements, axis components, and other components.
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf03.png)

Point elements and line elements are the basic elements of a line chart, and the related drawing configurations are essential:

- `lineChart.type`: Chart type, the type of line chart is `'line'`
- `lineChart.data`: Data source for chart drawing
- `lineChart.xField`: Continuous time interval or ordered category field, mapping the x coordinate of the element
- `lineChart.yField`: Numeric field, mapping the y coordinate of the element

Axis components, tooltip information, and other components that serve as auxiliary chart display components are optional configurations with default effects and functionality:

- `lineChart.axes`: Axis component, displayed by default and automatically infers the coordinate system and data mapping logic based on the chart type, detailed configuration can be found in [VChart Axis Component Configuration](../../../option/line/axes/lineChart#axes)
- `lineChart.tooltip`:tooltip information, displayed by default during interaction, detailed configuration can be found in [VChart Tooltip Information Component Configuration](../../../option/line/axes/lineChart#tooltip)
- For more component configurations, see [VChart lineChart Configuration](../../../option/lineChart)

## Quick Start

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Key Configurations

- `type`: Chart type, the type of line chart is `'line'`
- `xField` property declares a continuous time interval or ordered category field
- `yField` property declares a numeric field

## Chart Features

### Data

#### Data Structure

- A `discrete` or `time` field, such as: `month`  
  (`time` fields only support _timestamp_ format and need to be configured with `axes.type: 'time'` in the coordinate axis)
- A `numeric` field, such as: `temperature`

An example of a group of data for months and temperatures is defined below:

```ts
data: [
  {
    name: 'line',
    values: [
      {
        month: 'January',
        temperature: 8
      },
      {
        month: 'February',
        temperature: 9
      },
      {
        month: 'March',
        temperature: 11
      },
      {
        month: 'April',
        temperature: 14
      }
    ]
  }
];
```

#### Discontinuous Data Scenarios

Line charts with empty values in the data. Users can configure `lineChart.invalidType` to specify the connection method for non-compliant data points such as `null`, `undefined`, etc.

| lineChart.invalidType | Description                               |
| --------------------- | ----------------------------------------- |
| 'break'               | Break at this data point                  |
| 'link'                | Ignore this point and maintain continuity |
| 'zero'                | The default value for this point is 0     |
| 'ignore'              | Do not handle                             |

In this example, we show the change in the number of gold, silver, and bronze medals at the Olympic Games over time, with empty data in 1980.

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        medalType: 'Gold Medals',
        count: 40,
        year: '1952'
      },
      {
        medalType: 'Gold Medals',
        count: 32,
        year: '1956'
      },
      {
        medalType: 'Gold Medals',
        count: 34,
        year: '1960'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '1964'
      },
      {
        medalType: 'Gold Medals',
        count: 45,
        year: '1968'
      },
      {
        medalType: 'Gold Medals',
        count: 33,
        year: '1972'
      },
      {
        medalType: 'Gold Medals',
        count: 34,
        year: '1976'
      },
      {
        medalType: 'Gold Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Gold Medals',
        count: 83,
        year: '1984'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '1988'
      },
      {
        medalType: 'Gold Medals',
        count: 37,
        year: '1992'
      },
      {
        medalType: 'Gold Medals',
        count: 44,
        year: '1996'
      },
      {
        medalType: 'Gold Medals',
        count: 37,
        year: '2000'
      },
      {
        medalType: 'Gold Medals',
        count: 35,
        year: '2004'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '2008'
      },
      {
        medalType: 'Gold Medals',
        count: 46,
        year: '2012'
      },
      {
        medalType: 'Silver Medals',
        count: 19,
        year: '1952'
      },
      {
        medalType: 'Silver Medals',
        count: 25,
        year: '1956'
      },
      {
        medalType: 'Silver Medals',
        count: 21,
        year: '1960'
      },
      {
        medalType: 'Silver Medals',
        count: 26,
        year: '1964'
      },
      {
        medalType: 'Silver Medals',
        count: 28,
        year: '1968'
      },
      {
        medalType: 'Silver Medals',
        count: 31,
        year: '1972'
      },
      {
        medalType: 'Silver Medals',
        count: 35,
        year: '1976'
      },
      {
        medalType: 'Silver Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Silver Medals',
        count: 60,
        year: '1984'
      },
      {
        medalType: 'Silver Medals',
        count: 31,
        year: '1988'
      },
      {
        medalType: 'Silver Medals',
        count: 34,
        year: '1992'
      },
      {
        medalType: 'Silver Medals',
        count: 32,
        year: '1996'
      },
      {
        medalType: 'Silver Medals',
        count: 24,
        year: '2000'
      },
      {
        medalType: 'Silver Medals',
        count: 40,
        year: '2004'
      },
      {
        medalType: 'Silver Medals',
        count: 38,
        year: '2008'
      },
      {
        medalType: 'Silver Medals',
        count: 29,
        year: '2012'
      },
      {
        medalType: 'Bronze Medals',
        count: 17,
        year: '1952'
      },
      {
        medalType: 'Bronze Medals',
        count: 17,
        year: '1956'
      },
      {
        medalType: 'Bronze Medals',
        count: 16,
        year: '1960'
      },
      {
        medalType: 'Bronze Medals',
        count: 28,
        year: '1964'
      },
      {
        medalType: 'Bronze Medals',
        count: 34,
        year: '1968'
      },
      {
        medalType: 'Bronze Medals',
        count: 30,
        year: '1972'
      },
      {
        medalType: 'Bronze Medals',
        count: 25,
        year: '1976'
      },
      {
        medalType: 'Bronze Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Bronze Medals',
        count: 30,
        year: '1984'
      },
      {
        medalType: 'Bronze Medals',
        count: 27,
        year: '1988'
      },
      {
        medalType: 'Bronze Medals',
        count: 37,
        year: '1992'
      },
      {
        medalType: 'Bronze Medals',
        count: 25,
        year: '1996'
      },
      {
        medalType: 'Bronze Medals',
        count: 33,
        year: '2000'
      },
      {
        medalType: 'Bronze Medals',
        count: 26,
        year: '2004'
      },
      {
        medalType: 'Bronze Medals',
        count: 36,
        year: '2008'
      },
      {
        medalType: 'Bronze Medals',
        count: 29,
        year: '2012'
      }
    ]
  },
  xField: 'year',
  yField: 'count',
  seriesField: 'medalType',
  invalidType: 'break'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Elements and Styles

The main elements used in line charts are two: point and line. They correspond to chart elements like markers and lines. Each mark can be individually configured for its style, see the detailed configuration: [lineChart.line](../../../option/lineChart#line) and [lineChart.point](../../../option/lineChart#point)

#### Dashed Lines at the End

In chart making, there are often some personalized requirements. Taking the estimated trend of fund price fluctuations as an example, we hope that the estimated increase and decrease range will be connected by dashed lines and distinguished by different colors.

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        x: '1号',
        y: 0.012
      },
      {
        x: '2号',
        y: -0.01
      },
      {
        x: '3号',
        y: 0.005
      },
      {
        x: '4号',
        y: 0.007
      },
      {
        x: '5号',
        y: 0.01
      },
      {
        x: '6号',
        y: 0.017
      },
      {
        x: '7号',
        y: 0.022
      },
      {
        x: '8号预测',
        y: 0.033,
        latest: true
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  line: {
    style: {
      lineDash: data => {
        if (data.latest) {
          return [5, 5];
        }
        return [0];
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Marker Point Style

Marker points support custom shapes and sizes. We set the marker points to slightly larger triangles through configurations. For specific configurations, see [Configuration Documentation](../../../option/lineChart#point)

```ts
point: {
    style: {
      shape: 'triangle',
       size: 7
    }
  }
```

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  point: {
    style: {
      shape: 'triangle',
      size: 10
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Linear Gradient

By setting `lineChart.point: {visible: false}` to hide marker points, and configuring `lineChart.line.style.stroke: { gradient: 'linear' }` for gradient colors, we can achieve the effect of a gradient line.

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      fields: {
        y: {
          alias: 'minimum temperature'
        }
      },
      values: [
        {
          x: 'Monday',
          y: 18,
          c: 0
        },
        {
          x: 'Tuesday',
          y: 16,
          c: 0
        },
        {
          x: 'Wednesday',
          y: 17,
          c: 0
        },
        {
          x: 'Thursday',
          y: 18,
          c: 0
        },
        {
          x: 'Friday',
          y: 19,
          c: 0
        },
        {
          x: 'Saturday',
          y: 20,
          c: 0
        },
        {
          x: 'Sunday',
          y: 17,
          latest: true,
          c: 0
        },
        {
          x: 'Monday',
          y: 28,
          c: 1
        },
        {
          x: 'Tuesday',
          y: 26,
          c: 1
        },
        {
          x: 'Wednesday',
          y: 27,
          c: 1
        },
        {
          x: 'Thursday',
          y: 28,
          c: 1
        },
        {
          x: 'Friday',
          y: 29,
          c: 1
        },
        {
          x: 'Saturday',
          y: 30,
          c: 1
        },
        {
          x: 'Sunday',
          y: 27,
          latest: true,
          c: 1
        }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'c',
  line: {
    style: {
      curveType: 'basis',
      lineWidth: 2,
      stroke: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          {
            offset: 0,
            color: data => {
              if (data.c === 0) {
                return '#009800';
              }
              return '#000098';
            },
            opacity: 0
          },
          {
            offset: 0.5,
            color: data => {
              if (data.c === 0) {
                return '#1d983a';
              }
              return '#1d3a98';
            },
            opacity: 0.5
          },
          {
            offset: 1,
            color: data => {
              if (data.c === 0) {
                return '#4d98ca';
              }
              return '#4dca98';
            },
            opacity: 1
          }
        ]
      }
    }
  },
  point: {
    visible: false
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Gradient Color - Color Segmentation

By controlling the `offset` value of the gradient color, we can achieve a chart that displays color segmentation for different layers, such as warning colors for upper and lower boundaries.

```javascript livedemo
const spec = {
  data: {
    id: 'data1',
    values: [
      {
        x: '2:00',
        y: 82
      },
      {
        x: '4:00',
        y: 50
      },
      {
        x: '6:00',
        y: 64
      },
      {
        x: '8:00',
        y: 30
      },
      {
        x: '10:00',
        y: 40
      },
      {
        x: '12:00',
        y: 40
      },
      {
        x: '14:00',
        y: 56
      },
      {
        x: '16:00',
        y: 40
      },
      {
        x: '18:00',
        y: 64
      },
      {
        x: '20:00',
        y: 74
      },
      {
        x: '22:00',
        y: 98
      }
    ]
  },
  type: 'line',
  xField: 'x',
  yField: 'y',
  point: {
    style: {
      fill: data => {
        if (data.y > 60) {
          return 'green';
        }
        return 'red';
      }
    }
  },
  line: {
    style: {
      stroke: {
        gradient: 'linear',
        x0: 0.5,
        y0: 0,
        x1: 0.5,
        y1: 1,
        stops: [
          {
            offset: 0,
            color: 'green'
          },
          {
            offset: 0.5588235294117647,
            color: 'green'
          },
          {
            offset: 0.5588235294117647,
            color: 'red'
          },
          {
            offset: 1,
            color: 'red'
          }
        ]
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Smooth Line

Configure `curveType: 'monotone'` property in `lineChart.line.style`

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 38
      },
      {
        time: '4:00',
        value: 56
      },
      {
        time: '6:00',
        value: 10
      },
      {
        time: '8:00',
        value: 70
      },
      {
        time: '10:00',
        value: 36
      },
      {
        time: '12:00',
        value: 94
      },
      {
        time: '14:00',
        value: 24
      },
      {
        time: '16:00',
        value: 44
      },
      {
        time: '18:00',
        value: 36
      },
      {
        time: '20:00',
        value: 68
      },
      {
        time: '22:00',
        value: 22
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  line: {
    style: {
      curveType: 'monotone'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Step Line

Configure `curveType: 'step'|'stepAfter'|'stepBefore'` property in `line.style`

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 38
      },
      {
        time: '4:00',
        value: 56
      },
      {
        time: '6:00',
        value: 10
      },
      {
        time: '8:00',
        value: 70
      },
      {
        time: '10:00',
        value: 36
      },
      {
        time: '12:00',
        value: 94
      },
      {
        time: '14:00',
        value: 24
      },
      {
        time: '16:00',
        value: 44
      },
      {
        time: '18:00',
        value: 36
      },
      {
        time: '20:00',
        value: 68
      },
      {
        time: '22:00',
        value: 22
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  point: {
    visible: false
  },
  line: {
    style: {
      curveType: 'stepAfter'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
