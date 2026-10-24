---
category: examples
group: box plot
title: 基础箱型图
keywords: boxPlot,distribution,strip
order: 5-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/box-plot/basic-box-plot.png
option: boxPlotChart
---

# 基础箱型图

箱型图（英文：box plot），又称为盒须图、盒式图、盒状图或箱线图，是一种用作显示一组数据分散情况资料的统计图。因图形如箱子，且在上下四分位数之外常有线条像胡须延伸出去而得名。它主要用于反映原始数据分布的特征，还可以进行多组数据分布特征的比较。它能显示出一组数据的最大值、最小值、中位数、及上下四分位数。当有数值与上下四分位数的范围差距 1.5×IQR 以上时，该值为离群值（outlier）。离群值会有时会画成个别的点。

## 何时使用

1. 用于反映原始数据分布的特征，展示数据的最大最小值、中位数与上下四分位数、异常值。
2. 比较多个组之间的数据分布。

## 关键配置

- `direction` 属性配置为 'vertical'
- `minField`、`q1Field`、`medianField`、`q3Field`、`maxField` 分别声明数据中的最小值、下四分位数、中位数、上四分位数、最大值字段
- `boxWidth` 属性指定两个分位数组成的箱体的宽度
- `shaftWidth`属性指定最大最小值线段宽度
- `shaftShape`属性指定箱型图形状，分 line 和 bar 两种

## 代码演示

```javascript livedemo
const data = [
  {
    name: 'boxPlot',
    values: [
      {
        x: 'Sub-Saharan Africa',
        y1: 8.72,
        y2: 9.73,
        y3: 10.17,
        y4: 10.51,
        y5: 11.64
      },
      {
        x: 'South Asia',
        y1: 9.4,
        y2: 10.06,
        y3: 10.75,
        y4: 11.56,
        y5: 12.5
      },
      {
        x: 'Middle East & North Africa',
        y1: 9.54,
        y2: 10.6,
        y3: 11.05,
        y4: 11.5,
        y5: 11.92
      },
      {
        x: 'Latin America & Caribbean',
        y1: 8.74,
        y2: 9.46,
        y3: 10.35,
        y4: 10.94,
        y5: 12.21
      },
      {
        x: 'East Asia & Pacific',
        y1: 7.8,
        y2: 8.95,
        y3: 10.18,
        y4: 11.57,
        y5: 13.25
      },
      {
        x: 'Europe & Central Asia',
        y1: 9.52,
        y2: 10.39,
        y3: 10.93,
        y4: 11.69,
        y5: 12.63
      }
    ]
  }
];

const spec = {
  type: 'boxPlot',
  data: data,
  xField: 'x',

  minField: 'y1',
  q1Field: 'y2',
  medianField: 'y3',
  q3Field: 'y4',
  maxField: 'y5',
  direction: 'vertical',
  boxPlot: {
    style: {
      // boxWidth: 50, // 不指定则自适应宽度
      // shaftWidth: 60,
      shaftShape: 'line',
      lineWidth: 2
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[箱型图](link)
