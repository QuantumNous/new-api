---
category: examples
group: venn chart
title: Venn Chart
keywords: vennChart, proportion
cover: /vchart/preview/venn-chart_1.11.0.png
option: vennChart
---

# Venn Chart

Venn chart is a type of relational chart that represents the intersection relationship between sets through the cascading relationship between circles.

## Key Option

- `categoryField` declared as category field
- `valueField` declared as value field

## Demo source

```javascript livedemo
/** --Please add the following code when using it in your code -- */
// When using it in your code, please introduce registerVennChart and execute it
// import { registerVennChart } from '@visactor/vchart';
// registerVennChart();
/** --Please add the above code when using it in your code-- */

/** --Please delete the following code when using it in your code -- */
VCHART_MODULE.registerVennChart();
/** --Please delete the above code when using it in your code-- */

const spec = {
  type: 'venn',
  data: {
    values: [
      { sets: ['A'], value: 8 },
      { sets: ['B'], value: 10 },
      { sets: ['C'], value: 12 },
      { sets: ['A', 'B'], value: 4 },
      { sets: ['A', 'C'], value: 4 },
      { sets: ['B', 'C'], value: 4 },
      { sets: ['A', 'B', 'C'], value: 2 }
    ]
  },
  categoryField: 'sets',
  valueField: 'value',
  seriesField: 'sets',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Venn Chart](link)
