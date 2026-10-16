---
category: examples
group: liquid chart
title: 水波图指标智能反色
keywords: liquidChart, proportion
order: 25-3
cover: /vchart/preview/liquid-chart-smart-invert_1.9.0.png
option: liquidChart
---

# 水波图

水波图指标字体颜色支持智能反色(当水波图元遮挡指标颜色时, 指标颜色可以根据图元颜色做智能反色以保证文字的识别度。注意: 反色执行后, 指标颜色样式配置将不生效。)

## 关键配置

- `indicatorSmartInvert` 属性声明为反色是否开启。

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入registerLiquidChart并执行
// import { registerLiquidChart } from '@visactor/vchart';
// registerLiquidChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerLiquidChart();
/** --在业务中使用时请删除以上代码-- */
const spec = {
  type: 'liquid',
  valueField: 'value',
  data: {
    id: 'data',
    values: [
      {
        value: 0.8
      }
    ]
  },
  maskShape: 'drop', // 水滴
  // maskShape: 'circle',
  // maskShape: 'star',
  indicatorSmartInvert: true,
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
  },
  liquidBackground: {
    style: {
      fill: 'blue'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[水波图](link)
