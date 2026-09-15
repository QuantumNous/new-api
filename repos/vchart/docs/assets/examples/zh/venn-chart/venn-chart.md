---
category: examples
group: venn chart
title: 韦恩图
keywords: vennChart, proportion
cover: /vchart/preview/venn-chart_1.11.0.png
option: vennChart
---

# 韦恩图

韦恩图是关系型图表，通过图形与图形之间的层叠关系，来表示集合与集合之间的相交关系。

## 关键配置

- `categoryField` 属性声明为类别字段
- `valueField` 属性声明为值字段

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入registerVennChart并执行
// import { registerVennChart } from '@visactor/vchart';
// registerVennChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerVennChart();
/** --在业务中使用时请删除以上代码-- */

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

## 相关教程

[韦恩图](link)
