---
category: examples
group: line chart
title: 基础折线图
keywords: lineChart,comparison,trend,line
order: 0-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/line-chart/basic-line.png
option: lineChart
---

# 基础折线图

折线图通过将一系列数据点进行连接，构造出趋势。折线图用于分析事物随时间或有序类别而变化的趋势。如果有多组数据，则用于分析多组数据随时间变化或有序类别的相互作用和影响。折线的方向表示正/负变化。折线的斜率表示变化的程度。在这个例子中，我们创建了一个基础折线图用来展示一天的气温变化。

## 关键配置

- `xField` 属性声明为连续时间间隔或有序类别字段
- `yField` 属性声明数值字段

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[折线图](link)
