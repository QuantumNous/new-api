---
category: examples
group: liquid chart reverse
title: liquid chart supports reverse 
keywords: liquidChart, proportion
order: 25-4
cover: /vchart/preview/liquid-chart-reverse_1.11.10.png
option: liquidChart
---

# liquid chart supports reverse 

## Key Option

- `reverse` attribute declares whether the water wave diagram needs to be drawn in reverse from top to bottom.

## Demo source

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
  data: {
    id: 'data',
    values: [
      {
        value: 0.3
      }
    ]
  },
  reverse: true,
  indicator: {
    visible: true,
    title: {
      visible: true,
      style: {
        text: 'progress'
      }
    },
    content: [
      {
        visible: true,
        style: {
          fill: 'black',
          text: '30%'
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

## Related Tutorials

[Liquid Chart](link)
