# Graphic Elements

## Basic Concepts

Graphic elements are the basic drawing units in charts, and all the graphics in the charts are composed of graphic elements. Graphic elements can be points, lines, rectangles, circles, sectors, rings, paths, etc. In a chart, the type of graphic elements is usually determined by the series type. The number and style of the graphic elements are determined by the data, such as the points in a line chart, the columns in a column chart, the sectors in a pie chart, etc.

## Style Attributes of Graphic Elements

There are usually two types of attributes for graphic elements: common attributes and specific attributes. Common attributes are those shared by all graphic elements, such as position, size, rotation angle, transparency, etc. Specific attributes are usually unique to specific types of graphic elements, for example, the points in a line chart can be configured with `shape`, and the sectors in a pie chart can be configured with `inner radius` | `outer radius`, etc.

The configurable attributes of specific graphic elements can be found in the corresponding chart documentation.

## States of Graphic Elements

In VChart, the states of graphic elements are abstracted based on common chart interactions and are divided into the following categories:

- `default`: Default state, the initial state of the graphic element.
- `hover`: Pointer hover state, the state of the graphic element when it is hovered over by the mouse pointer.
- `hover_reverse`: Non-pointer hover state, the state of other graphic elements when a graphic element enters the `hover` state.
- `selected`: Selected state, the state of the graphic element when it is selected.
- `selected_reverse`: Non-selected state, the state of other graphic elements when a graphic element enters the `selected` state.
- `dimension_hover`: Dimension hover state, the state when the mouse pointer hovers within a certain `x` axis area.
- `dimension_hover_reverse`: Non-dimension hover state, the state of other graphic elements when a graphic element enters the `dimension_hover` state.

In different states, graphic elements can be individually configured with styles. For example, in the `hover` state, the color of the graphic element can be configured to be red, while in the `default` state, the color can be configured to be blue. Moreover, multiple states can be active simultaneously. For example, in the `hover` state, the color of the graphic element can be configured to be red, while in the `selected` state, the size can be configured. In this case, when the selected element is hovered over, the color is red and the size is 10. See the example below:

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'lineData',
      values: [
        { date: 'Monday', class: 'classNo.1', score: 20 },
        { date: 'Monday', class: 'classNo.2', score: 30 },

        { date: 'Tuesday', class: 'classNo.1', score: 25 },
        { date: 'Tuesday', class: 'classNo.2', score: 28 }
      ]
    }
  ],
  seriesField: 'class',
  xField: 'date',
  yField: 'score',
  point: {
    style: {
      fill: 'blue'
    },
    state: {
      hover: {
        style: {
          fill: 'red'
        }
      },
      selected: {
        style: {
          size: 10
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### Custom States of Graphic Elements

In addition to the built-in interaction states, VChart also supports custom states. The configuration method for custom states is consistent with that for built-in states. However, when configuring, the state name needs to be specified. For example, in the following example, a `custom` state is configured. When the graphic element enters the `custom` state, its color is red.

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'lineData',
      values: [
        { date: 'Monday', class: 'classNo.1', score: 20 },
        { date: 'Monday', class: 'classNo.2', score: 30 },

        { date: 'Tuesday', class: 'classNo.1', score: 25 },
        { date: 'Tuesday', class: 'classNo.2', score: 28 }
      ]
    }
  ],
  seriesField: 'class',
  xField: 'date',
  yField: 'score',
  point: {
    state: {
      custom: {
        filter: datum => {
          return datum.score >= 30;
        },
        style: {
          fill: 'red'
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Style Configuration of Graphic Elements

The most common configuration method can be seen in the examples above, where the style values can be directly configured in the corresponding styles. In addition to this method, VChart also supports two other configuration methods.

### Scale Configuration

By configuring styles through `scale`. The advantage of this method is that by configuring the styles of graphic elements through `scale`, a relationship between the styles of graphic elements and the data can be established. For example, the size of graphic elements can be configured according to the data size, or the color of graphic elements can be configured according to the data color, etc.

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'data1',
      values: [
        { x: 'Q1', y: 0, type: 'typeA' },
        { x: 'Q1', y: 50, type: 'typeB' },
        { x: 'Q2', y: 100, type: 'typeA' },
        { x: 'Q2', y: 200, type: 'typeB' }
      ]
    },
    {
      id: 'data2',
      values: [
        { x: 'Q1', y: 80, group: 'typeC' },
        { x: 'Q1', y: -50, group: 'typeD' },
        { x: 'Q2', y: 150, group: 'typeC' },
        { x: 'Q2', y: 180, group: 'typeD' }
      ]
    }
  ],
  series: [
    {
      type: 'scatter',
      xField: 'x',
      yField: 'y',
      dataId: 'data1',
      seriesField: 'type',
      point: {
        style: {
          size: {
            field: 'y',
            scale: 'sizeScale'
          },
          shape: {
            field: 'type',
            scale: 'shapeScale'
          }
        }
      }
    },
    {
      type: 'line',
      xField: 'x',
      yField: 'y',
      dataId: 'data2',
      seriesField: 'group',
      point: {
        style: {
          size: {
            field: 'y',
            scale: 'sizeScale'
          },
          shape: {
            field: 'group',
            scale: 'shapeScale'
          }
        }
      }
    }
  ],
  scales: [
    {
      id: 'shapeScale',
      type: 'ordinal',
      domain: [
        {
          dataId: 'data1',
          fields: ['type']
        },
        {
          dataId: 'data2',
          fields: ['group']
        }
      ],
      range: ['circle', 'rect', 'triangle', 'diamond']
    },
    {
      id: 'sizeScale',
      type: 'linear',
      domain: [
        {
          dataId: 'data1',
          fields: ['y']
        },
        {
          dataId: 'data2',
          fields: ['y']
        }
      ],
      range: [10, 20]
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom' }]
};
// 最终 scale 的 domain 如下：
// shapeScale.domain() === ['typeA','typeB','typeC','typeD'];
// sizeScale.domain() === [-50,200];

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

For the specific usage of scales, please refer to the documentation [scale](../../../../option/barChart#scales).

### Function Configuration

By configuring styles through functions, the highest level of flexibility can be achieved, and arbitrary customizations can be made to the styles of graphic elements. For example, in the following example, the color of the graphic element is configured through a function. When the `y` value of the data is greater than or equal to 30, the color of the graphic element is red; otherwise, it is blue.

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'lineData',
      values: [
        { date: 'Monday', class: 'classNo.1', score: 20 },
        { date: 'Monday', class: 'classNo.2', score: 30 },

        { date: 'Tuesday', class: 'classNo.1', score: 25 },
        { date: 'Tuesday', class: 'classNo.2', score: 28 }
      ]
    }
  ],
  seriesField: 'class',
  xField: 'date',
  yField: 'score',
  point: {
    style: {
      fill: datum => {
        if (datum.score >= 30) {
          return 'red';
        }
        return 'blue';
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Gradient configuration

The graphic elements of the chart can be configured with gradient colors, [column graph](../../../../demo/gradient/bar), [line graph](../../../.. /demo/gradient/line), [area](../../../../demo/gradient/bar), [bubble](../../../../demo /gradient/bar) etc. can be used.

### The basic concept and configuration interface of gradient color

VChart's gradient color configuration format aligns with CanvasRenderingContext2D's gradient color API. Different gradient types have different gradient effects. Generally speaking, the gradient color capability we provide is based on a specific two-dimensional space rule to fill graphics with continuous colors.

- [LinearGradient](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient)
- [RadialGradient](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createRadialGradient)
- [ConicGradient](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createConicGradient)

If you want to understand the drawing mechanism of the gradient color, please read the corresponding gradient color document above, which has a detailed description of the effect.

Gradient configuration for VChart:

```ts
interface IGradientStop {
  offset: number;
  color: string;
}
export type IGradientColor = ILinearGradient | IRadialGradient | IConicalGradient;
export interface ILinearGradient {
  gradient: 'linear';
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  stops: IGradientStop[];
}
export interface IRadialGradient {
  gradient: 'radial';
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  r0?: number;
  r1?: number;
  stops: IGradientStop[];
}
export interface IConicalGradient {
  gradient: 'conical';
  startAngle?: number;
  endAngle?: number;
  x?: number;
  y?: number;
  stops: IGradientStop[];
}
export interface IColorStop {
  offset: number;
  color: string;
}
```

### The relationship between the coordinate position of the gradient color and the primitive

Each gradient configuration has multiple position-related properties. Take the most commonly used linear gradient as an example:

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/tutorials/color-gradient.png" alt="线性渐变示意">
</div>

There are 2 sets of coordinates in the configuration: `[x0,y0], [x1,y1]` represent the start and end points of the linear gradient respectively, and the gradient color will proceed along the route from the start point to the end point. In VChart, the configuration of these two sets of coordinates is also supported, but there are `some differences` from the native API. In the native API, these two sets of coordinates are pixel positions. In VChart, in order to facilitate user configuration, we provide a proportional configuration based on the element's bounding box.

Use several pictures to illustrate the gradient position of different chart elements

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/tutorials/line-gradient.png" alt="Gradient coordinates of the line">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/tutorials/rect-gradient.png" alt="Gradient coordinates of the rect">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/tutorials/point-gradient.png" alt="Gradient coordinates of the point">
</div>

Therefore, when configuring `x0: 0, y0: 0.5, x1: 1, y1: 0.5` on the gradient color of the line, it means that the direction of the gradient is from left to right.

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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### The meaning of gradient color stop

In VChart, the stop in the gradient configuration is no different from the native drawing API above. When stop is the key node of the gradient color, the color will be different according to the gradient type between the key nodes.

We can imagine that the complete gradient is a `[0,1]` number axis, and stop is the point on this number axis. After we configure a fixed color for the corresponding point, other points on the number axis will be based on the 2 before and after it. A stop for color difference.

In the schematic diagram below, 4 stops are set, and the color of the entire column is filled according to the difference rule:

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/tutorials/linear-gradient.png" alt="线的渐变坐标">
</div>

Based on stop we can make a specific [gradient color chart](../../../../demo/gradient/enhancement-gradient-line)

This particular gradient color chart expects the portion of the line above 60 points to be green and the portion below 60 points to be red. We can find a way to make a specific set of stops to achieve

```ts
// We first use scores to divide these stop nodes
0 => 'red'
60 => 'red'
60 => 'green'
100 => 'green'
```

Yes, you can set two stop nodes at the same numerical position, so that the difference is always `red` for the position **less than 60 minutes**, and the difference is always `red` for the position **greater than 60 minutes**. It's `green`.

Now one question is how to calculate the stop of 60 points, its actual scale coordinates in the graph. Here is a calculation method.

ps: It is necessary to obtain the maximum and minimum values in the data in advance

```ts
const max; // The maximum value in the data, which can be obtained by traversing the data
const min; // The minimum value in the data, which can be obtained by traversing the data
const mid = 60; // the data value you want to use as the dividing point
const percent = (max - mid) / (max - min);
```

The complete configuration can be viewed in [diagram example](../../../../demo/gradient/enhancement-gradient-line)
