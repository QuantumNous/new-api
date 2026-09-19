---
category: examples
group: storytelling
title: 柱状图、饼图间切换的全局动画
keywords: animation,morphing,bar,pie,barChart,pieChart,comparison
order: 42-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/morph-bar-to-pie.gif
option: pieChart#animationUpdate
---

# 柱状图、饼图间切换的全局动画

我们常会根据不同的可视化目的，使用不同的图表类型。同一份数据，在切换不同图表类型时，也可以有全局的过渡动画，让可视化更加生动。

## 关键配置

## 代码演示

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

## 相关教程

[散点图](link)
