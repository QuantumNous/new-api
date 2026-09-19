---
category: examples
group: line chart
title: 折线图防重叠
keywords: lineChart,comparison,trend,line
order: 0-11
cover: /vchart/preview/line-overlap_1.6.0.png
option: lineChart
---

# 折线图防重叠

在折线图中，当数据点过于密集时，防止数据点重叠以确保更清晰地展示每条线的趋势和数值。

## 关键配置

- `markOverlap` 属性声明为是否开启防重叠

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/overlap-data.json');
const data = await response.json();

const dataSeries = [];
data.forEach(d => {
  dataSeries.push({
    ...d,
    type: 'a'
  });
  dataSeries.push({
    ...d,
    y: d.y + 20,
    type: 'b'
  });
});
const spec = {
  type: 'line',
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  markOverlap: true,
  stack: true,
  data: [
    {
      name: 'line',
      values: dataSeries
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[折线图](link)
