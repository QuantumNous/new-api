---
category: demo
group: data
title: 基础数据使用
keywords: data
order: 34-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/data/basic-data.png
option: lineChart#data
---

# 基础数据使用

绝大多数图表都需要配置数据。`data` 中可以配置一组数据，图表的 `series` 默认使用第 0 个数据。数据配置 `id` 后，在系列和其他可以指定数据的模块中，可以通过配置 `dataId` 来绑定数据。数据的 `values` 中配置数据的内容。

## 关键配置

在 `data` 的 values 属性配置图表需要的数据

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Monday', y: 12 },
        { x: 'Tuesday', y: 13 },
        { x: 'Wednesday', y: 11 },
        { x: 'Thursday', y: 10 },
        { x: 'Friday', y: 12 },
        { x: 'Saturday', y: 14 },
        { x: 'Sunday', y: 17 }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  axes: [{ orient: 'left' }, { orient: 'bottom' }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[数据](link)
