---
category: examples
group: area chart
title: 基础面积图
keywords: areaChart,comparison,trend,area
order: 1-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/basic-area.png
option: areaChart
---

# 基础面积图

面积图以图形方式显示定量数据。 它基于折线图。 通常用颜色，纹理和阴影线强调轴和线之间的区域。 通常，一个面积图会比较两个或多个数量。面积图适用于想要体现在连续自变量下，一组或多组数据的趋势变化以及相互之间的对比，同时也能够观察到数据总量的变化趋势。

## 关键配置

- `type: area` 属性声明为面积图
- `xField` 属性声明为分类字段或时序字段
- `yField` 属性声明为数值字段
- `crosshair` 属性声明为十字准星，用于显示数据的详细信息, `xField.visible` 开启 x 轴的十字准星

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
