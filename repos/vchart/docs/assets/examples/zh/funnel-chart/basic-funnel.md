---
category: examples
group: funnel chart
title: 基础漏斗图
keywords: funnelChart,composition,trend,triangle
order: 8-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/funnel-chart/basic-funnel.png
option: funnelChart
---

# 基础漏斗图

漏斗图，形如“漏斗”，用于单流程分析，在开始和结束之间由 N 个流程环节组成，通常这 N 个流程环节，有逻辑上的顺序关系。

## 何时使用

1. 数据是有序的，彼此之间有逻辑上的顺序关系，阶段最好大于 3 个。
2. 该流程应是“消耗性”的流程，如在电商领域，注册用户一定是经过层层消耗，才到达下单环节；在人力领域，收到的简历一定经过多轮筛选，才进入终面。

## 关键配置

- `type: funnel` 指定图表类型为漏斗图
- `categoryField` 指定分类字段
- `valueField` 指定值字段

## 代码演示

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[漏斗图](link)
