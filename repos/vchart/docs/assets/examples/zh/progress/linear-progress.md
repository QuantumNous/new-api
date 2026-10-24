---
category: examples
group: progress
title: 条形进度图
keywords: linearProgress,comparison,rectangle
order: 16-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c81702.png
option: linearProgressChart
---

# 条形进度图

条形进度图是直角坐标系下的一种图表类型。其可以将多个指标的百分比值进行并列显示，适合对目标达成进度进行评估。

## 何时使用

1. 展示目标达成进度。
2. 比较不同分类目标达成进度的大小。

## 关键配置

- `categoryField`、`valueField` 属性分别用于指定数据类别与矩形长度字段

## 代码演示

```javascript livedemo
const spec = {
  type: 'linearProgress',
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
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  seriesField: 'type',

  cornerRadius: 20,
  bandWidth: 30,
  axes: [
    {
      orient: 'left',
      label: { visible: true },
      type: 'band',
      domainLine: { visible: false },
      tick: { visible: false }
    },
    { orient: 'bottom', label: { visible: true }, type: 'linear', visible: false }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[条形进度图](link)
