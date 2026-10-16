---
category: examples
group: progress
title: 环形进度图
keywords: circularProgress,comparison,circle,indicator
order: 16-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/progress/circular-progress.png
option: circularProgressChart
---

# 环形进度图

环形进度图是极坐标系下的一种图表类型。其可以将多个指标的百分比值进行并列显示，适合对目标达成进度进行评估。本质上，环形进度图和玫瑰图几乎只有一个差别：玫瑰图的径向轴是连续轴，角度轴是离散轴；而环形进度图的径向轴是离散轴，角度轴是连续轴。环形进度图可以将多个指标的百分比值进行并列显示，适合对目标达成进度进行评估。

## 何时使用

1. 展示目标达成进度。
2. 比较不同分类目标达成进度的大小。

## 关键配置

- `categoryField`、`valueField` 属性分别用于指定数据类别与弧形角度字段
- `innerRadius`、`outerRadius` 属性用于指定进度图的内外半径

## 代码演示

```javascript livedemo
const spec = {
  type: 'circularProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.795,
          text: '79.5%'
        },
        {
          type: 'Business Companies',
          value: 0.25,
          text: '25%'
        },
        {
          type: 'Customer-facing Companies',
          value: 0.065,
          text: '6.5%'
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  seriesField: 'type',
  radius: 0.8,
  innerRadius: 0.5,
  roundCap: true,
  cornerRadius: 20,
  progress: {
    style: {
      innerPadding: 5,
      outerPadding: 5
    }
  },
  axes: [
    {
      visible: false,
      type: 'linear',
      orient: 'angle'
    },
    {
      visible: false,
      type: 'band',
      orient: 'radius'
    }
  ],
  indicator: {
    visible: true,
    trigger: 'hover',
    title: {
      visible: true,
      field: 'type',
      autoLimit: true,
      style: {
        fontSize: 20,
        fill: 'black'
      }
    },
    content: [
      {
        visible: true,
        field: 'text',
        style: {
          fontSize: 16,
          fill: 'gray'
        }
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'right',
    title: {
      visible: false
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)
