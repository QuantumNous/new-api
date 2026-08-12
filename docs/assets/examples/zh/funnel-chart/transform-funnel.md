---
category: examples
group: funnel chart
title: 转化漏斗图
keywords: funnelChart,composition,trend,triangle
order: 8-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/funnel-chart/transform-funnel.png
option: funnelChart
---

# 转化漏斗图

在这个例子中，我们创建了一个转化漏斗图用来跟踪从推送到购买这个流程中的用户转化率。

## 何时使用

1. 数据是有序的，彼此之间有逻辑上的顺序关系，阶段最好大于 3 个。

2. 该流程应是“消耗性”的流程，如在电商领域，注册用户一定是经过层层消耗，才到达下单环节；在人力领域，收到的简历一定经过多轮筛选，才进入终面。

## 关键配置

- 指定图表表类型`type: funnel`为漏斗图
- `categoryField` 指定分类字段
- `valueField` 指定值字段
- `isTransform: true` 配置为转化漏斗图，图表中会显示转化层；
- `transformLabel.visible: true` 配置显示转化层的标签；
- `outerLabel` 为漏斗层外部标签配置
  - `outerLabel.visible: true` 外部标签默认不显示，需要配置为 true
  - `outerLabel.position: 'right'` 配置为右侧显示

## 代码演示

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  isTransform: true,
  isCone: false,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 5676,
          name: 'Sent'
        },
        {
          value: 3872,
          name: 'Viewed'
        },
        {
          value: 1668,
          name: 'Clicked'
        },
        {
          value: 610,
          name: 'Add to Cart'
        },
        {
          value: 565,
          name: 'Purchased'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Percentage of the customers have dropped from the sales process'
  },
  label: {
    visible: true
  },
  transformLabel: {
    visible: true
  },
  outerLabel: {
    position: 'right',
    visible: true
  },
  legends: {
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
