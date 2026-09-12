# Area Chart

[\[Configuration Manual\]](../../../option/areaChart)

## Introduction

Area charts visually display quantitative data. It is based on line charts. Areas between the axis and the line are often emphasized with colors, textures, and shading lines. Typically, an area chart compares two or more quantities. Area charts are suitable for illustrating the trend changes of one or more groups of data under continuous independent variables, as well as comparing them with each other, while also being able to observe the changing trend of the total data.

In VChart, you can use the [area chart configuration](../../../option/areaChart) to display the changing trends of both data components and total data simultaneously. As shown below, this example shows the trend of sales of different cosmetics:

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523219.png)

In the [area chart example](../../../demo/area-chart/stacked-area) shown above, you need to use the following key configurations:

- `seriesField` attribute is used to declare the field participating in color mapping
- `stack` attribute is declared as true for configuring stacking, which will be stacked according to the field declared in the `seriesField` attribute

## Chart Composition

The area chart is composed of point elements, line elements, axes, and other components.
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a04.png)

Point elements and line elements are essential for area charts, and relevant drawing configurations are indispensable:

- `areaChart.type`: Chart type, the type of area chart is `'area'`
- `areaChart.data`: Data source for chart rendering
- `areaChart.xField`: Continuous time interval or ordered category field, mapping element's x-coordinate
- `areaChart.yField`: Numerical field, mapping element's y-coordinate

Axes, tooltips, and other auxiliary chart display components are optional configurations with default effects and functionalities:

- `areaChart.axes`: Axis components, automatically displayed and inferred according to chart type with coordinate system and data mapping logic, for detailed configuration see [VChart Axis Component Configuration](../../../option/areaChart#axes)
- `areaChart.tooltip`: Tooltip information, displayed interactively by default, for detailed configuration see [VChart Tooltip Configuration](../../../option/areaChart#tooltip)
- For more component configurations see [VChart areaChart configuration](../../../option/areaChart)

## Quick Start

```javascript livedemo
const spec = {
  type: 'area',
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

### Key Configuration

- `type`: Chart type, the type of area chart is `'area'`
- `xField` attribute is declared as a continuous time interval or an ordered category field
- `yField` attribute is declared as a numerical field

## Area Chart Features

### Data

- A `discrete` or `sequential` field, such as: `month`  
  (`Sequential` field data only supports timestamp format, and needs to be configured with `axes.type: 'time'` in the axis)
- A `numerical` field, such as: `temperature`

A set of month and temperature data is defined as follows:

```ts
data: [
  {
    name: 'area',
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

### Chart Layout

#### Stacked Area Chart

Similar to stacked bar charts, stacked area charts not only show the differences between different categories within the same dimension but also show the differences in the total amount of different categories within the same dimension.
In VChart, if you need to display a stacked area chart, you need to configure `areaChart.stack: true`, and in order to distinguish the areas stacked together within the same dimension, you need to specify the `areaChart.seriedField` field, which defaults to mapping the area color

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: 'Stacked area chart of cosmetic products sales'
  },
  stack: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom', padding: { top: 30 } }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Percentage Stacked Area Chart

In the percentage stacked area chart, the height of each stacked segment only represents its proportion of the total height, not the actual value. This makes it easier for users to compare the relative weight and trend changes of each subcategory or category within the overall data.
In VChart, if you want to display a percentage stacked area chart, you need to configure `areaChart.stack: true` and `areaChart.percent: true`. And you also need to specify the `areaChart.seriedField` field, which defaults to mapping the area color.

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: '100% stacked area chart of cosmetic products sales'
  },
  percent: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom', padding: { top: 30 } }],
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod(val) {
          return `${(val * 100).toFixed(2)}%`;
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

### Elements and Styles

#### Smooth Area Chart

Configure the `curveType: 'monotone'` attribute in the `line.style` property, and the `style.curveType` attribute of the default area element will automatically synchronize, so there is no need to configure it again

```javascript livedemo
const spec = {
  type: 'area',
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

#### Step Area Chart

Configure the `curveType: 'step' | 'stepAfter' | 'stepBefore'` attribute in the `line.style` property

```javascript livedemo
const spec = {
  type: 'area',
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
