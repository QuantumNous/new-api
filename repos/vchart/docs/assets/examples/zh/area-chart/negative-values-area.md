---
category: examples
group: area chart
title: 带负值面积图
keywords: areaChart,comparison,trend,area
order: 1-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/negative-values-area.png
option: areaChart
---

# 带负值面积图

数据具有正负值时的面积图。

## 关键配置

- `type: area` 属性声明为面积图
- `xField` 属性声明为分类字段或时序字段
- `yField` 属性声明为数值字段

## 代码演示

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: -9
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
        value: -16
      },
      {
        time: '12:00',
        value: -17
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

[面积图](link)
