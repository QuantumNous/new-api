---
category: demo
group: axis
title: 多层级坐标轴
keywords: barChart,axis
order: 25-19
cover: /vchart/preview/multiple-layers-of-axis-1_1.9.0.png
option: barChart#axes
---

# 多层级坐标轴(实例 2)

当图表存在多层分组时，可以通过为 band 轴开启 `showAllGroupLayers` 属性，绘制多层级标签的坐标轴

## 关键配置

为对应方向的轴配置： `showAllGroupLayers: true`

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      values: [
        { type: 'Category One', min: 76, max: 100, range: 'A', type2: 'p', color: 'A_p' },
        { type: 'Category Two', min: 56, max: 108, range: 'A', type2: 'p', color: 'A_p' },
        { type: 'Category One', min: 56, max: 100, range: 'B', type2: 'p', color: 'B_p' },
        { type: 'Category Two', min: 36, max: 108, range: 'B', type2: 'p', color: 'B_p' },

        { type: 'Category One', min: 76, max: 100, range: 'A', type2: 'k', color: 'A_k' },
        { type: 'Category Two', min: 56, max: 108, range: 'A', type2: 'k', color: 'A_k' },
        { type: 'Category One', min: 56, max: 100, range: 'B', type2: 'k', color: 'B_k' },
        { type: 'Category Two', min: 36, max: 108, range: 'B', type2: 'k', color: 'B_k' }
      ]
    }
  ],
  xField: ['type', 'range', 'type2'],
  yField: 'min',
  seriesField: 'color',
  paddingInner: [0.6, 0.6, 0.6],
  bandPadding: [0.6, 0.6, 0.6],
  label: {
    position: 'bothEnd'
  },
  axes: [
    {
      orient: 'bottom',
      showAllGroupLayers: true,
      sampling: false,
      tick: {
        tickCount: 2
      }
    }
  ],
  legends: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
