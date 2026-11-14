---
category: examples
group: liquid chart
title: liquid chart supports custom shape
keywords: liquidChart, proportion
order: 25-1
cover: /vchart/preview/liquid-chart-shape_1.9.0.png
option: liquidChart
---

# 水波图

liquid chart supports custom shape.

## Key Option

- `maskShape` declared as outline shape.

option values:

- `'drop'`
- `'circle'`
- `'cross'`
- `'diamond'`
- `'square'`
- `'arrow'`
- `'arrow2Left'`
- `'arrow2Right'`
- `'wedge'`
- `'thinTriangle'`
- `'triangle'`
- `'triangleUp'`
- `'triangleDown'`
- `'triangleRight'`
- `'triangleLeft'`
- `'stroke'`
- `'star'`
- `'wye'`
- `'rect'`

## Demo Source

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
        value: 0.4
      }
    ]
  },
  maskShape: 'drop', // drop shape
  // maskShape: 'circle',
  // maskShape: 'star',
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
          text: '40%'
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
