# Progress Chart

[\[Linear Progress Chart Option Manual\]](../../../option/linearProgressChart)  
[\[Circular Progress Chart Option Manual\]](../../../option/circularProgressChart)

## Introduction

Progress charts are a type of visualization chart used to express the progress and status of tasks or activities. They typically display the percentage of a task's completion in an intuitive and easy-to-understand manner. To meet the visualization needs of different scenarios, VChart provides users with both linear progress charts and circular progress charts.

## Linear Progress Chart

A linear progress chart is a rectangular progress chart, typically consisting of a background frame and an inner fill block that represents the progress and status of a task. During operation, the fill block gradually increases as the task is completed until it reaches 100% progress, showing the user the progress and completion of the task.

### Chart Composition

The linear progress chart consists of the rectangular chart element representing progress, the rectangular chart element representing the background, tooltips information, and other components.  
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda0b.png)

- `linearProgressChart.type`: Chart type, the type of linear progress chart is `'linearProgress'`
- `linearProgressChart.data`: Data source for chart drawing
- `linearProgressChart.xField`: Category field, mapping different progress bars, i.e., the number of progress bars is determined by the number of categories
- `linearProgressChart.yField`: Value field, mapping the length of the rectangular chart element representing progress. In VChart, the progress bar represents a progress not exceeding 100%, so the data in this field should be within the `[0, 1]` range

Tooltip information and other components that act as auxiliary chart displays are optional configurations with default effects and functionality:

- `linearProgressChart.tooltip`: Tooltip information, displayed by default during interaction, see [VChart Tooltip Component Configuration](../../../option/linearProgressChart#tooltip) for detailed configuration
- For more component configurations, see [VChart linearProgressChart configuration](../../../option/linearProgressChart)

### Quick Start

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.6
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',

  cornerRadius: 20,
  bandWidth: 30
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

### Key Configuration

- `categoryField` and `valueField` properties are used to specify the category and rectangular length fields respectively

### Linear Progress Chart Features

#### Data

- A `discrete` field, e.g.: `type`, representing data categories, which can also be understood as the progress of what kind of project the progress chart is showing
- A `numeric` field, e.g.: `value`, representing chart element length, which can also be understood as the progress value to be displayed

Since a progress chart usually displays the progress of only one project, there is typically only one piece of data.

```ts
data: [
  {
    id: 'linearProgress',
    values: [
      {
        type: 'Goal A',
        value: 0.6
      }
    ]
  }
];
```

#### Margin Configuration

`linearProgressChart.progress.leftPadding`, `linearProgressChart.progress.rightPadding`, `linearProgressChart.progress.topPadding`, and `linearProgressChart.progress.bottomPadding` can be used to configure the margin of the linear progress chart separately.

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.7
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  progress: {
    topPadding: 10,
    bottomPadding: 10
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### Progress Bar Width/Height Configuration

`linearProgressChart.bandWidth` can be used to configure the width/height of the progress bar.

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.7
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  bandWidth: 50
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### Linear Gradient Fill

By configuring the gradient color with `linearProgressChart.progress.style.fill: { gradient: 'linear' }`, you can achieve a gradient bar effect.

```javascript livedemo
const gradientColor = {
  gradient: 'linear',
  x0: 0.5,
  y0: 0.4,
  x1: 1,
  y1: 0.5,
  stops: [
    {
      offset: 0,
      color: '#4FC6B4'
    },
    {
      offset: 1,
      color: '#31679E'
    }
  ]
};

const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.6
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',

  cornerRadius: 20,
  bandWidth: 30,
  axes: [
    { orient: 'left', label: { visible: true }, type: 'band' },
    { orient: 'bottom', label: { visible: true }, type: 'linear' }
  ],

  progress: {
    style: {
      fill: gradientColor
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### Threshold Mode Fill

In progress charts, people often want to use different colors to represent progress status, conveying a semantic visual expression. For example, red represents lagging progress, and green represents smooth progress.
In VChart, this can be achieved through the method of attribute mapping for chart element properties, and of course, you can customize attribute mapping on any chart element in any chart.
The definition method is as follows:

```ts
progress: {
  style: {
    fill: {
      type: 'threshold', // Mapping type
      field: 'percent', // Mapping field
      domain: [0.6, 0.8], // Data range
      range: ['#D04D5B', '#ED9747', '#579E78'] // Mapping result range
    }
  }
}
```

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.7
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  cornerRadius: 20,
  bandWidth: 30,

  progress: {
    style: {
      fill: {
        type: 'threshold',
        field: 'percent',
        domain: [0.6, 0.8],
        range: ['#D04D5B', '#ED9747', '#579E78']
      }
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

## Circular Progress Chart

A circular progress chart is a round progress chart that typically includes a background ring and a filled arc block inside to represent the progress and status of a task. During operation, the fill arc block gradually increases as the task is completed, and does not exceed 100% progress, showing the user the progress and completion of the task.

Compared to linear progress charts, circular progress charts can display more information in the same size and are more aesthetically pleasing. They are widely used in many fields, such as fitness, study notes, design, etc.

### Chart Composition

The circular progress chart consists of the arc chart element representing progress, the arc chart element representing the background, tooltip information, and other components.  
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a07.png)

- `circularProgressChart.type`: Chart type, the type of circular progress chart is `'circularProgress'`
- `circularProgressChart.data`: Data source for chart drawing
- `circularProgressChart.categoryField`: Category field, mapping different progress bars, i.e., the number of progress bars is determined by the number of categories
- `circularProgressChart.valueField`: Value field, mapping the arc range of the arc chart element representing progress

Optional components, which are auxiliary chart displays, have self-contained default effects and functionality:

- `circularProgressChart.tooltip`: Tooltip information, displayed by default during interaction, and more detailed configurations can be found in [VChart Tooltip Component Configuration](../../../option/circularProgress[type]tooltip)
- For more component configurations, see [VChart circularProgressChart configuration](../../../option/circularProgress[type])

### Quick Start

```javascript livedemo
const spec = {
  type: 'circularProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.8
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  outerRadius: 0.6,
  innerRadius: 0.5,
  cornerRadius: 20
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### Key Configuration

- `categoryField` and `valueField` properties are used to specify the category and arc angle fields respectively
- `innerRadius`, `outerRadius`, and `cornerRadius` properties are used to specify the inner and outer radius of the progress chart and the rounded corners of the arc chart element

### Circular Progress Chart Features

#### Data

- A `discrete` field, e.g.: `type`, representing the data category or what kind of project the progress chart is showing
- A `numeric` field, e.g.: `value`, representing the chart element length or the progress value to be displayed

For circular progress charts, if there are multiple data entries, the chart will automatically adapt to group effects, so they support multiple data entries.

```ts
data: [
  {
    id: 'circularProgress',
    values: [
      {
        type: 'Goal A',
        value: 0.6
      },
      {
        type: 'Goal B',
        value: 0.8
      }
    ]
  }
];
```

#### Group Circular Progress Chart

When there is more than one category of data, the circular progress chart will present a grouping effect, i.e. multiple rings nested together. At this point, in order to distinguish between different categories, you can use `circularProgress.seriesField` to specify the category field, which will be mapped to the chart element color.

```javascript livedemo
const spec = {
  type: 'circularProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.795,
          text: '79.5%'
        },
        {
          type: 'Business Companies',
          value: 0.25,
          text: '25%'
        },
        {
          type: 'Customer-facing Companies',
          value: 0.065,
          text: '6.5%'
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  seriesField: 'type',
  radius: 0.8,
  innerRadius: 0.5,
  roundCap: true,
  cornerRadius: 20,
  progress: {
    style: {
      innerPadding: 5,
      outerPadding: 5
    }
  },
  axes: [
    {
      visible: false,
      type: 'linear',
      orient: 'angle'
    },
    {
      visible: false,
      type: 'band',
      orient: 'radius'
    }
  ],
  indicator: {
    visible: true,
    trigger: 'hover',
    title: {
      visible: true,
      field: 'type',
      autoLimit: true,
      style: {
        fontSize: 20,
        fill: 'black'
      }
    },
    content: [
      {
        visible: true,
        field: 'text',
        style: {
          fontSize: 16,
          fill: 'gray'
        }
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'right',
    title: {
      visible: false
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Margin Configuration

`circularProgressChart.progress.innerPadding` and `circularProgressChart.progress.outerPadding` can be used separately to configure the inner and outer padding of the circular progress chart.

```javascript livedemo
const spec = {
  type: 'circularProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'A',
          value: 0.8
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  outerRadius: 0.6,
  innerRadius: 0.5,
  cornerRadius: 20,
  innerPadding: 2,
  outerPadding: 5
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window.vchart = vchart;
```

#### Corner Radius Configuration

`circularProgressChart.cornerRadius` and `circularProgressChart.roundCap` can be used to specify the corner radius and whether the rounded part protrudes, respectively.
