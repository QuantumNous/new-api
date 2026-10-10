# Liquid Chart

[\[Configuration Manual\]](../../../option/liquidChart)

## Introduction

liquid chart usually display data by filling a circle with dynamic water waves, and are often used to show real-time progress.

### Chart composition

A liquid chart consists of liquid mark（`liquid`），liquidBackground mark（`liquidBackground`）and liquidOutline mark(`liquidOutline`).
![](/vchart/preview/liquid_tutorial_1.9.0.png)

The data fields and data maps of the liquid chart are configured as follows:

- `liquidChart.type`: Chart type, the type of liquid chart
- `liquidChart.data`: Data source for graphing
- `liquidChart.valueField` The attribute is declared as a value field configuration, used to represent the height of the water wave

- For more component configurations, see[VChart liquid configuration](../../../option/liquidChart)

### Get started quickly

```javascript livedemo
/** --Please add the following code when using it in your code -- */
// When using it in your code, please introduce registerLiquidChart and execute it
// import { registerLiquidChart } from '@visactor/vchart';
// registerLiquidChart();
/** --Please add the above code when using it in your code-- */

/** --Please delete the following code when using it in your code -- */
VCHART_MODULE.registerLiquidChart();
/** --Please delete the above code when using it in your code-- */

const spec = {
  type: 'liquid',
  valueField: 'value',
  maskShape: 'drop',
  outlineMargin: 10,
  outlinePadding: 10,
  indicatorSmartInvert: true,
  data: {
    id: 'data',
    values: [
      {
        value: 0.8
      }
    ]
  },
  indicator: {
    visible: true,
    title: {
      visible: true,
      style: {
        text: '进度'
      }
    },
    content: [
      {
        visible: true,
        style: {
          fill: 'black',
          text: '80%'
        }
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### Key Options

- The `valueField` attribute is declared as a value field configuration
- The `maskShape` property is declared as an outline shape
- The `outlineMargin` attribute is declared as the padding between the outer outline and the region boundary
- The `outlinePadding` attribute is declared as the padding between the inner outline and the outer outline
- The `indicatorSmartInvert` attribute declares whether to enable smart inversion of indicator values.

## Liquid Chart

### Data

- A `value` field, such as: `value`, maps the height of the water wave primitive.

A set of progress data is defined as follows:

```ts
data: [
  {
    values: [{ value: 0.5 }]
  }
];
```
