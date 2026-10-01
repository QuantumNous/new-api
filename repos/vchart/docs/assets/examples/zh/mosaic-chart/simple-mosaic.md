---
category: examples
group: mosaic chart
title: 基础马赛克图
keywords: mosaic,comparison,distribution,rectangle,composition,proportion
cover: /vchart/preview/mosaic-chart-simple-mosaic_1.11.6.png
option: mosaicChart
---

# 基础马赛克图

马赛克图也可以用于没有分组的数据，用于同时展示数值的量和占比；

## 关键配置

- label 设置多种数据标签，分别展示分类和数值

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入registerMosaicChart并执行
// import { registerMosaicChart } from '@visactor/vchart';
// registerMosaicChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerMosaicChart();
/** --在业务中使用时请删除以上代码-- */
const spec = {
  type: 'mosaic',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  label: [
    {
      visible: true,
      position: 'bottom',
      style: {
        fill: '#333'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return datum['month'];
      }
    },
    {
      visible: true,
      position: 'top',
      style: {
        fill: '#333'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return datum['sales'];
      }
    }
  ],
  axes: [
    {
      orient: 'bottom',
      label: {
        visible: false
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
