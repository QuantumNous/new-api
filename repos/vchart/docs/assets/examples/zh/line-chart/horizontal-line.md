---
category: examples
group: line chart
title: 垂直折线图
keywords: lineChart,comparison,trend,line
order: 0-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/line-chart/horizontal-line.png
option: lineChart
---

# 垂直折线图

方向垂直的折线图。

## 关键配置

- `direction` 属性声明为 `horizontal`
- `xField` 属性声明数值字段
- `yField` 属性声明为连续时间间隔或有序类别字段
- `axes` 属性设置为左侧轴为 `band` 类型，下侧轴为 `linear` 类型

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
  xField: 'value',
  yField: 'time',
  direction: 'horizontal',
  axes: [
    { orient: 'left', type: 'band' },
    { orient: 'bottom', type: 'linear' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[折线图](link)
