---
category: examples
group: storytelling
title: Global animation for switching between bar and pie charts
keywords: animation,morphing,bar,pie,barChart,pieChart,comparison
order: 42-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/morph-bar-to-pie.gif
option: pieChart#animationUpdate
---

# Global animation for switching between bar and pie charts

We often use different chart types for different visualization purposes. The same data, when switching between different chart types, can also have global transition animations to make the visualization more vivid.

## Key configuration

## Demo source

```javascript livedemo
/**
 * 自1.12.0后，全局形变动画需要手动注册才能生效
 *
 * import { registerMorph } from '@visactor/vchart';
 *
 * registerMorph();
 *
 * 自2.0.0开始，全局形变动画默认开启，不再需要手动注册
 */
VCHART_MODULE.registerMorph && VCHART_MODULE.registerMorph();
const pieSpec = {
  type: 'pie',
  data: [
    {
      values: [
        { type: '1', value: Math.random() },
        { type: '2', value: Math.random() },
        { type: '3', value: Math.random() }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.6,
  valueField: 'value',
  categoryField: 'type',
  tooltip: false
};

const barSpec = Object.assign({}, pieSpec, {
  type: 'bar',
  xField: 'type',
  yField: 'value',
  seriesField: 'type'
});

const specs = [pieSpec, barSpec];

const vchart = new VChart(specs[0], { dom: CONTAINER_ID });

vchart.renderSync();
let count = 1;
setInterval(() => {
  vchart.updateSpec(specs[count % 2]);
  count++;
}, 2000);
```

## Related Tutorials

[Scatterplot](link)
