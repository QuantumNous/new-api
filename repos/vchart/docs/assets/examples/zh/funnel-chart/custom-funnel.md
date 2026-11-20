---
category: examples
group: funnel chart
title: 自定义漏斗图
keywords: funnelChart,composition,trend,custom
order: 8-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/funnel-chart/custom-funnel.png
option: funnelChart
---

# 自定义漏斗图

## 何时使用

1. 数据是有序的，彼此之间有逻辑上的顺序关系，阶段最好大于 3 个。

2. 该流程应是“消耗性”的流程，如在电商领域，注册用户一定是经过层层消耗，才到达下单环节；在人力领域，收到的简历一定经过多轮筛选，才进入终面。

## 关键配置

- 指定图表表类型`type: common` ，即组合图
- `categoryField` 指定分类字段
- `valueField` 指定值字段
- `region` 数组配置了 4 个区域
  - 通过百分比配置区域宽高和偏移量
- `series[i].regionIndex`可以指定系列绘制的 region 区域，默认为 0，即第一个区域

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  padding: 0,
  data: [
    {
      id: 'funnel1',
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
    },
    {
      name: 'funnel2',
      values: [
        {
          value: 200,
          name: 'Step1'
        },
        {
          value: 160,
          name: 'Step2'
        },
        {
          value: 120,
          name: 'Step3'
        },
        {
          value: 80,
          name: 'Step4'
        },
        {
          value: 40,
          name: 'Step5'
        }
      ]
    }
  ],
  layout: {
    type: 'grid',
    col: 4,
    row: 3,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        row: 0,
        colSpan: 4
      },
      {
        modelId: 'left',
        col: 0,
        row: 1,
        rowSpan: 2
      },
      {
        modelId: 'right',
        col: 1,
        row: 1,
        rowSpan: 2
      },
      {
        modelId: 'right-top',
        col: 2,
        row: 1,
        colSpan: 2
      },
      {
        modelId: 'right-bottom',
        col: 2,
        row: 2,
        colSpan: 2
      }
    ]
  },
  region: [
    {
      id: 'left'
    },
    {
      id: 'right',
      padding: {
        left: 1
      }
    },
    {
      id: 'right-top'
    },
    {
      id: 'right-bottom',
      padding: {
        top: 1
      }
    }
  ],
  series: [
    {
      type: 'funnel',
      dataIndex: 0,
      gap: 2,
      range: {
        max: 200
      },
      funnelOrient: 'top',
      funnelAlign: 'right',
      categoryField: 'name',
      valueField: 'value',
      isCone: false,
      funnel: {
        style: {
          cornerRadius: 4,
          lineWidth: 0
        }
      },
      outerLabel: {
        visible: true,
        alignLabel: false,
        position: 'left'
      }
    },
    {
      type: 'funnel',
      regionIndex: 1,
      dataIndex: 1,
      gap: 2,
      funnelOrient: 'top',
      funnelAlign: 'left',
      categoryField: 'name',
      valueField: 'value',
      isCone: false,
      funnel: {
        style: {
          cornerRadius: 4,
          lineWidth: 0
        }
      }
    },
    {
      type: 'funnel',
      dataIndex: 0,
      regionIndex: 2,
      gap: 1,
      funnelOrient: 'top',
      funnelAlign: 'left',
      categoryField: 'name',
      valueField: 'value',
      isCone: false,
      funnel: {
        style: {
          lineWidth: 0
        }
      },
      outerLabel: {
        visible: true,
        alignLabel: false,
        position: 'right'
      }
    },
    {
      type: 'funnel',
      regionIndex: 3,
      dataIndex: 1,
      gap: 1,
      funnelOrient: 'bottom',
      funnelAlign: 'left',
      categoryField: 'name',
      valueField: 'value',
      isCone: false,
      label: { visible: true, style: { text: '' } },
      outerLabel: {
        visible: true,
        alignLabel: false,
        position: 'right'
      },
      funnel: {
        style: {
          lineWidth: 0
        }
      }
    }
  ],
  legends: {
    id: 'legend',
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

[漏斗图](link)
