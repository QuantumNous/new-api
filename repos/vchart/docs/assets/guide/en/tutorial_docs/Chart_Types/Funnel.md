# Funnel Chart

[\[Configuration Manual\]](../../../option/funnelChart)

## Introduction

Funnel chart, shaped like a "funnel", is used for single-process analysis. It consists of N process links between the start and the end, which usually have a logical order.

## Chart Components

Funnel chart consists of basic elements and other components such as hierarchical polygon elements (default is trapezoid, but can also be rectangle, depending on user configuration), transformation layers, labels, etc.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/4d877ccaf041cff1618de3405.png)

Polygon elements are the basic elements of the funnel chart, and related drawing configurations are essential:

- `funnelChart.type`: Chart type, the type of funnel chart is `'funnel'`
- `funnelChart.data`: Data source for chart drawing
- `funnelChart.categoryField`: Category field, mapped to different graphic elements
- `funnelChart.valueField`: Value field, mapped to the size of the rectangular element or the length of the top and bottom edges of the trapezoidal element

Transformation layers, labels, and other auxiliary elements are displayed only under specific configurations and have slightly different forms:

- `funnelChart.label`: Funnel chart label configuration, displayed when '`visible: true'`.
- `funnelChart.isTransform`: Whether to display transformation layer, displayed when the configuration is '`true'`.

Tooltip information and other components that assist in chart display are optional configurations with default effects and features:

- `funnelChart.tooltip`: Tooltip, displayed by default during interaction, detailed configuration can be found [VChart tooltip component configuration](../../../option/funnelChart#tooltip)
- For more component configurations, see [VChart funnelChart configuration](../../../option/funnelChart)

## Quick Start

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Key Configuration

- `type: funnel` Specifies the chart type as a funnel chart
- `categoryField` Specifies the category field
- `valueField` Specifies the value field

## Funnel Chart Features

### Data

- A `discrete` field, such as: `name`, representing different funnel layers
- A `numeric` field, such as: `value`, representing the values of different funnel layers

It should be noted that, since the funnel chart represents the transformation relationship between different processes, logically, the data has an order and is theoretically greater than 3 phases.

```ts
data: [
  {
    name: 'funnel',
    values: [
      {
        name: 'Step1',
        value: 100
      },
      {
        name: 'Step2',
        value: 80
      },
      {
        name: 'Step3',
        value: 60
      }
    ]
  }
];
```

### Funnel Chart Layout

#### Transformation Funnel Chart

When configured as `funnelChart.isTransform: true`, the funnel chart adds a transformation layer between layers and automatically calculates the conversion rate, conversion rate = lower data / upper data, which represents the value change of the next step compared to the previous step.

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  isTransform: true,
  isCone: false,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 5676,
          name: 'Sent'
        },
        {
          value: 3872,
          name: 'Viewed'
        },
        {
          value: 1668,
          name: 'Clicked'
        },
        {
          value: 610,
          name: 'Add to Cart'
        },
        {
          value: 565,
          name: 'Purchased'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Percentage of the customers have dropped from the sales process'
  },
  label: {
    visible: true
  },
  transformLabel: {
    visible: true
  },
  outerLabel: {
    position: 'right',
    visible: true
  },
  legends: {
    visible: true,
    orient: 'top',
    padding: {
      bottom: 10
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Funnel Chart Alignment

You can specify the funnel chart orientation by `funnelChart.funnelAlign: 'left' | 'right' | 'center'`, with a default value of `'center'`.

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  funnelAlign: 'left',
  isTransform: true,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Funnel Chart Orientation

You can specify the funnel chart orientation by `funnelChart.funnelOrient: 'left' | 'right' | 'top' | 'bottom'`, with a default value of `'top'`.

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  funnelOrient: 'right',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Graphics and Styles

#### Funnel Chart Element Shape

The funnel chart element shape defaults to a trapezoid, i.e., the default value of `funnelChart.shape` is `'trapezoid'`.
In VChart, the funnel chart shape can also be specified as a rectangle, i.e., `funnelChart.shape: 'rect'`.

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  shape: 'rect',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Funnel Bottom Sharp Corner

When the funnel chart element shape is the default trapezoid `'trapezoid'`, you can specify whether the bottom layer has a sharp corner by `funnelChart.isCone`, with a default value of `true`.

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  isCone: false,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Funnel Layer Pixel Spacing

You can specify the pixel spacing between funnel layers by `funnelChart.gap`, with a default value of `0`.

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  gap: 10,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

#### Funnel Maximum and Minimum Width

You can specify the pixel spacing between funnel layers by `funnelChart.maxSize` and `funnelChart.minSize`, which support configuring pixel values and percentages. The default values are `'80%'` and `0`, respectively.

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  maxSize: '60%',
  minSize: 30,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom',
    padding: {
      top: 20
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
