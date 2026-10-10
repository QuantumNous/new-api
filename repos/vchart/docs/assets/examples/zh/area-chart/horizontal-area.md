---
category: examples
group: area chart
title: 垂直面积图
keywords: areaChart,comparison,trend,area
order: 1-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/horizontal-area.png
option: areaChart
---

# 垂直面积图

方向垂直的面积图。

## 关键配置

- `type: area` 属性声明为面积图
- `direction` 属性声明为 `horizontal`
- `xField` 属性声明为数值字段
- `yField` 属性声明为分类字段或时序字段

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
  direction: 'horizontal'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[面积图](link)
